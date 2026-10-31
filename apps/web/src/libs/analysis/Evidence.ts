import { evidenceFileTypes, isEvidenceFileType, maxEvidenceFileBytes, sourceOf } from '@celia/core';
import type { EvidenceType } from '@celia/core';
import { and, asc, count, eq } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { gatewayUrl, getPinnedFile, unpinFile } from '@/libs/Pinata';
import { caseActionSchema, caseEvidenceSchema, caseStatementSchema } from '@/models/Schema';
import {
  EvidenceReviewValidation,
  EvidenceValidation,
  maxEvidence,
} from '@/validations/EvidenceValidation';

const fileTypes = new Set<EvidenceType>(Object.values(evidenceFileTypes));

/**
 * Lists a case's evidence besides statements, oldest first, with the address each file is read from.
 * @param caseId - The case id.
 * @returns The evidence.
 */
export async function listEvidence(caseId: string) {
  const rows = await db
    .select()
    .from(caseEvidenceSchema)
    .where(eq(caseEvidenceSchema.caseId, caseId))
    .orderBy(asc(caseEvidenceSchema.createdAt));

  return rows.map((row) => ({
    id: row.id,
    source: sourceOf(row.type),
    type: row.type,
    title: row.title,
    note: row.note,
    sourceUrl: row.sourceUrl,
    capturedOn: row.capturedOn,
    cid: row.cid,
    fileUrl: row.cid ? gatewayUrl(row.cid) : null,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    chain: row.chain,
    reference: row.reference,
    statementId: row.statementId,
    actionId: row.actionId,
    reviewState: row.reviewState,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }));
}

export type CaseEvidence = Awaited<ReturnType<typeof listEvidence>>[number];

type EvidenceFields = NonNullable<ReturnType<typeof EvidenceValidation.safeParse>['data']>;

/**
 * The columns the form fills in, with the ones left blank as null.
 * @param fields - The checked fields.
 * @returns The values to store.
 */
function evidenceValues(fields: EvidenceFields) {
  return {
    type: fields.type,
    title: fields.title,
    note: fields.note ?? null,
    sourceUrl: fields.sourceUrl ?? null,
    capturedOn: fields.capturedOn ?? null,
    chain: fields.chain ?? null,
    reference: fields.reference ?? null,
    statementId: fields.statementId ?? null,
    actionId: fields.actionId ?? null,
  };
}

/**
 * Checks that the statement and the action evidence is linked to belong to the same case.
 * @param caseId - The case id.
 * @param fields - The checked fields.
 * @returns `statement` or `action` when the one named is not of this case; nothing when both are fine or not given.
 */
async function missingLink(caseId: string, fields: EvidenceFields) {
  if (fields.statementId) {
    const [statement] = await db
      .select({ id: caseStatementSchema.id })
      .from(caseStatementSchema)
      .where(
        and(eq(caseStatementSchema.id, fields.statementId), eq(caseStatementSchema.caseId, caseId)),
      );

    if (!statement) {
      return 'statement' as const;
    }
  }

  if (fields.actionId) {
    const [action] = await db
      .select({ id: caseActionSchema.id })
      .from(caseActionSchema)
      .where(and(eq(caseActionSchema.id, fields.actionId), eq(caseActionSchema.caseId, caseId)));

    if (!action) {
      return 'action' as const;
    }
  }

  return null;
}

/**
 * Adds evidence to a case. A video, image or document was already uploaded from the browser straight to IPFS, so the form carries
 * only Pinata's id for it; the CID, size and type kept here are read back from Pinata and not taken from the browser. A file that is
 * not an allowed type or the right kind is unpinned. The audit holds the type and the CID, never the title.
 * @param options - What to add.
 * @param options.caseId - The case id.
 * @param options.input - The fields as entered, checked here.
 * @param options.pinId - Pinata's id for the uploaded file, for a video, image or document.
 * @param options.actor - The staff member.
 * @returns `ok`, or why not: `invalid`, `words`, `full`, `file` (missing, too large or not the allowed type for what was chosen),
 * `statement` or `action` (not one of this case) or `taken` (that file is already used).
 */
export async function addEvidence(options: {
  caseId: string;
  input: unknown;
  pinId: string | null;
  actor: { id: string; email: string | null };
}) {
  const parsed = EvidenceValidation.safeParse(options.input);

  if (!parsed.success) {
    return parsed.error.issues.some((issue) => issue.message === 'forbidden_words')
      ? ('words' as const)
      : ('invalid' as const);
  }

  const fields = parsed.data;
  const needsFile = fileTypes.has(fields.type);
  const pinned = needsFile && options.pinId ? await getPinnedFile(options.pinId) : null;

  if (
    needsFile &&
    (!options.pinId ||
      !pinned ||
      pinned.size > maxEvidenceFileBytes ||
      !isEvidenceFileType(pinned.mimeType) ||
      evidenceFileTypes[pinned.mimeType] !== fields.type)
  ) {
    if (options.pinId) {
      await unpinFile(options.pinId);
    }

    return 'file' as const;
  }

  const missing = await missingLink(options.caseId, fields);

  if (missing) {
    return missing;
  }

  const [held] = await db
    .select({ total: count() })
    .from(caseEvidenceSchema)
    .where(eq(caseEvidenceSchema.caseId, options.caseId));

  if ((held?.total ?? 0) >= maxEvidence) {
    if (options.pinId && pinned) {
      await unpinFile(options.pinId);
    }

    return 'full' as const;
  }

  return await db.transaction(async (tx) => {
    const [used] = pinned
      ? await tx
          .select({ id: caseEvidenceSchema.id })
          .from(caseEvidenceSchema)
          .where(eq(caseEvidenceSchema.pinId, options.pinId ?? ''))
      : [];

    if (used) {
      return 'taken' as const;
    }

    await tx.insert(caseEvidenceSchema).values({
      ...evidenceValues(fields),
      caseId: options.caseId,
      cid: pinned?.cid ?? null,
      pinId: pinned ? options.pinId : null,
      fileName: pinned?.name ?? null,
      mimeType: pinned?.mimeType ?? null,
      sizeBytes: pinned?.size ?? null,
      createdBy: options.actor.id,
    });
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'evidence_added',
      target: { type: 'case', id: options.caseId },
      details: { type: fields.type, ...(pinned && { cid: pinned.cid }) },
    });

    return 'ok' as const;
  });
}

/**
 * Changes the details of evidence that is already on a case: its title, note, link, date, chain and reference, and the statement
 * and action it backs. What kind it is and the file itself cannot change; to replace those, remove it and add it again.
 * @param options - What to change.
 * @param options.caseId - The case id, so evidence can only be changed in its own case.
 * @param options.id - The evidence id.
 * @param options.input - The fields as entered, checked here.
 * @param options.actor - The staff member.
 * @returns `ok`, or why not: `invalid`, `words`, `missing` (no such evidence), `type` (the kind cannot change) or `statement` or
 * `action` (not one of this case).
 */
export async function updateEvidence(options: {
  caseId: string;
  id: string;
  input: Record<string, unknown>;
  actor: { id: string; email: string | null };
}) {
  // The staff member confirmed the material was public and lawful when they added it.
  const parsed = EvidenceValidation.safeParse({ ...options.input, lawful: true });

  if (!parsed.success) {
    return parsed.error.issues.some((issue) => issue.message === 'forbidden_words')
      ? ('words' as const)
      : ('invalid' as const);
  }

  const [row] = await db
    .select({ type: caseEvidenceSchema.type })
    .from(caseEvidenceSchema)
    .where(
      and(eq(caseEvidenceSchema.id, options.id), eq(caseEvidenceSchema.caseId, options.caseId)),
    );

  if (!row) {
    return 'missing' as const;
  }

  if (row.type !== parsed.data.type) {
    return 'type' as const;
  }

  const missing = await missingLink(options.caseId, parsed.data);

  if (missing) {
    return missing;
  }

  return await db.transaction(async (tx) => {
    await tx
      .update(caseEvidenceSchema)
      .set(evidenceValues(parsed.data))
      .where(
        and(eq(caseEvidenceSchema.id, options.id), eq(caseEvidenceSchema.caseId, options.caseId)),
      );
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'evidence_updated',
      target: { type: 'case', id: options.caseId },
      details: { type: parsed.data.type },
    });

    return 'ok' as const;
  });
}

/**
 * Records the review of a piece of off-chain evidence: where it stands and what staff found. On-chain evidence is read by a
 * notebook, so it has no review. The audit holds the state, never the note.
 * @param options - What to record.
 * @param options.caseId - The case id, so evidence can only be reviewed in its own case.
 * @param options.id - The evidence id.
 * @param options.input - The state and note as entered, checked here.
 * @param options.actor - The staff member.
 * @returns `ok`, or why not: `invalid`, `words`, `missing` (no such evidence) or `type` (on-chain evidence has no review).
 */
export async function reviewEvidence(options: {
  caseId: string;
  id: string;
  input: unknown;
  actor: { id: string; email: string | null };
}) {
  const parsed = EvidenceReviewValidation.safeParse(options.input);

  if (!parsed.success) {
    return parsed.error.issues.some((issue) => issue.message === 'forbidden_words')
      ? ('words' as const)
      : ('invalid' as const);
  }

  const [row] = await db
    .select({ type: caseEvidenceSchema.type })
    .from(caseEvidenceSchema)
    .where(
      and(eq(caseEvidenceSchema.id, options.id), eq(caseEvidenceSchema.caseId, options.caseId)),
    );

  if (!row) {
    return 'missing' as const;
  }

  if (sourceOf(row.type) !== 'off_chain') {
    return 'type' as const;
  }

  return await db.transaction(async (tx) => {
    await tx
      .update(caseEvidenceSchema)
      .set({
        reviewState: parsed.data.state,
        reviewNote: parsed.data.note ?? null,
        reviewedBy: options.actor.id,
        reviewedAt: new Date(),
      })
      .where(
        and(eq(caseEvidenceSchema.id, options.id), eq(caseEvidenceSchema.caseId, options.caseId)),
      );
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'evidence_reviewed',
      target: { type: 'case', id: options.caseId },
      details: { state: parsed.data.state },
    });

    return 'ok' as const;
  });
}

/**
 * Removes evidence from a case, stops pinning its file and records it in the staff audit. Copies that others took of a public file
 * cannot be recalled.
 * @param options - What to remove.
 * @param options.caseId - The case id, so evidence can only be removed from its own case.
 * @param options.id - The evidence id.
 * @param options.actor - The staff member.
 * @returns True when evidence was removed.
 */
export async function removeEvidence(options: {
  caseId: string;
  id: string;
  actor: { id: string; email: string | null };
}) {
  const removed = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(caseEvidenceSchema)
      .where(
        and(eq(caseEvidenceSchema.id, options.id), eq(caseEvidenceSchema.caseId, options.caseId)),
      )
      .returning({ pinId: caseEvidenceSchema.pinId, cid: caseEvidenceSchema.cid });

    if (!row) {
      return null;
    }

    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'evidence_removed',
      target: { type: 'case', id: options.caseId },
      details: row.cid ? { cid: row.cid } : {},
    });

    return row;
  });

  if (removed?.pinId) {
    await unpinFile(removed.pinId);
  }

  return removed !== null;
}
