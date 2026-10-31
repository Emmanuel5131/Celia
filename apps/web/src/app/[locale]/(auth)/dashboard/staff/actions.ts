'use server';

import { clerkClient } from '@clerk/nextjs/server';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { setCounselReview } from '@/libs/accounts/CounselProfile';
import { lookupRegistry, lookupSanctions } from '@/libs/accounts/Lookups';
import { requireStaff } from '@/libs/accounts/Staff';
import { recordStaffAction, staffActor } from '@/libs/accounts/StaffAudit';
import { approveBrief } from '@/libs/analysis/Analysis';
import {
  addEvidence,
  removeEvidence,
  reviewEvidence,
  updateEvidence,
} from '@/libs/analysis/Evidence';
import { addStatement, removeStatement, updateStatement } from '@/libs/analysis/Statements';
import { recordCaseEvent } from '@/libs/cases/CaseEvents';
import { addConfirmedClaim } from '@/libs/cases/Cases';
import { refreshCaseStory, refreshStoriesForClaims } from '@/libs/cases/CaseStory';
import { answerReport, saveCheckedReport } from '@/libs/cases/Reports';
import { signalsFor } from '@/libs/claims/Signals';
import { decideRequest } from '@/libs/contact/ContactRequests';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { notify } from '@/libs/notifications/Notify';
import { claimantIds, verifiedCounselIds } from '@/libs/notifications/Recipients';
import { unsuppress } from '@/libs/notifications/Suppression';
import { signUpload } from '@/libs/Pinata';
import { deleteConnection } from '@/libs/sandworm/Connection';
import {
  caseActionSchema,
  caseReportSchema,
  caseSchema,
  claimProofSchema,
  claimSchema,
  emailMessageSchema,
  institutionApplicationSchema,
  userSettingSchema,
} from '@/models/Schema';
import { parseAccount } from '@/utils/accounts/Account';
import { approvalRefusal, rejectReasons, reviewChecks } from '@/utils/accounts/Institution';
import type { RejectReason } from '@/utils/accounts/Institution';
import { caseStatuses } from '@/utils/cases/Case';
import { emailLocale } from '@/utils/notifications/NotifyPlan';
import { ActionValidation } from '@/validations/ActionValidation';
import { OperatorsValidation } from '@/validations/OperatorsValidation';

const ApplicationCheckValidation = z.object({
  userId: z.string().min(1),
  check: z.enum(reviewChecks),
  value: z.boolean(),
});

/**
 * Ticks or unticks one check on an application in review. Changing a check after it was marked ready takes the mark off, so the
 * person who approves always approves what was last checked.
 * @param input - The application, the check and whether it passed.
 * @param input.userId - The applicant's Clerk user id.
 * @param input.check - Which check.
 * @param input.value - Whether it passed.
 */
export async function setApplicationCheck(input: {
  userId: string;
  check: string;
  value: boolean;
}) {
  const staff = await requireStaff();
  const parsed = ApplicationCheckValidation.safeParse(input);

  if (!parsed.success) {
    return;
  }

  const { userId, check, value } = parsed.data;
  await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ checks: institutionApplicationSchema.checks })
      .from(institutionApplicationSchema)
      .where(
        and(
          eq(institutionApplicationSchema.userId, userId),
          eq(institutionApplicationSchema.status, 'in_review'),
        ),
      );

    if (!found) {
      return;
    }

    await tx
      .update(institutionApplicationSchema)
      .set({ checks: { ...found.checks, [check]: value }, readyBy: null, readyAt: null })
      .where(eq(institutionApplicationSchema.userId, userId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_checked',
      target: { type: 'application', id: userId },
      details: { check, value: String(value) },
    });
  });
  revalidatePath('/', 'layout');
}

/**
 * Runs the registry and sanctions lookups for an application and keeps what they found, for staff to read. They inform the checks;
 * staff still tick each one themselves.
 * @param userId - The applicant's Clerk user id.
 */
export async function runApplicationLookups(userId: string) {
  const staff = await requireStaff();
  const [found] = await db
    .select({ organisation: institutionApplicationSchema.organisation })
    .from(institutionApplicationSchema)
    .where(
      and(
        eq(institutionApplicationSchema.userId, userId),
        eq(institutionApplicationSchema.status, 'in_review'),
      ),
    );

  if (!found) {
    return;
  }

  const client = await clerkClient();
  const applicant = await client.users.getUser(userId);
  const [registry, sanctions] = await Promise.all([
    lookupRegistry(found.organisation),
    lookupSanctions({
      organisation: found.organisation,
      person: [applicant.firstName, applicant.lastName].filter(Boolean).join(' '),
    }),
  ]);

  await db.transaction(async (tx) => {
    await tx
      .update(institutionApplicationSchema)
      .set({ lookups: { registry, sanctions }, lookedUpAt: new Date() })
      .where(eq(institutionApplicationSchema.userId, userId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_lookup',
      target: { type: 'application', id: userId },
    });
  });
  revalidatePath('/', 'layout');
}

/**
 * Marks an application ready for a second person to approve. Every check must be ticked first.
 * @param userId - The applicant's Clerk user id.
 * @returns `checks_incomplete` when a check is still open; otherwise nothing.
 */
export async function markApplicationReady(
  userId: string,
): Promise<'ok' | 'missing' | 'checks_incomplete'> {
  const staff = await requireStaff();
  const result = await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ checks: institutionApplicationSchema.checks })
      .from(institutionApplicationSchema)
      .where(
        and(
          eq(institutionApplicationSchema.userId, userId),
          eq(institutionApplicationSchema.status, 'in_review'),
        ),
      );

    if (!found) {
      return 'missing';
    }

    if (!reviewChecks.every((check) => found.checks[check] === true)) {
      return 'checks_incomplete';
    }

    await tx
      .update(institutionApplicationSchema)
      .set({ readyBy: staff.id, readyAt: new Date() })
      .where(eq(institutionApplicationSchema.userId, userId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_ready',
      target: { type: 'application', id: userId },
    });

    return 'ok';
  });
  revalidatePath('/', 'layout');

  return result;
}

/**
 * Approves an application, which opens the account. It needs every check ticked and a second person: the one who marked it ready
 * cannot approve it in production. Only an account that is counsel and waiting for review can be approved, so this cannot be used
 * to give any other account the role.
 * @param userId - The applicant's Clerk user id.
 * @returns The reason it was refused, or `ok`.
 */
export async function approveApplication(
  userId: string,
): Promise<'ok' | 'missing' | 'checks_incomplete' | 'not_ready' | 'same_person'> {
  const staff = await requireStaff();
  const [found] = await db
    .select()
    .from(institutionApplicationSchema)
    .where(
      and(
        eq(institutionApplicationSchema.userId, userId),
        eq(institutionApplicationSchema.status, 'in_review'),
      ),
    );

  if (!found) {
    return 'missing';
  }

  const refusal = approvalRefusal({
    checks: found.checks,
    readyBy: found.readyBy,
    actor: staff.id,
    production: Env.NODE_ENV === 'production',
  });

  if (refusal !== 'ok') {
    return refusal;
  }

  const client = await clerkClient();
  const target = await client.users.getUser(userId);
  const account = parseAccount(target.publicMetadata);

  if (account?.accountType !== 'counsel' || account.review !== 'pending') {
    return 'missing';
  }

  await client.users.updateUserMetadata(userId, { publicMetadata: { review: 'verified' } });
  await db.transaction(async (tx) => {
    await tx
      .update(institutionApplicationSchema)
      .set({
        status: 'approved',
        decidedBy: staff.id,
        decidedAt: new Date(),
      })
      .where(eq(institutionApplicationSchema.userId, userId));
    await setCounselReview(tx, userId, 'verified');
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_approved',
      target: { type: 'application', id: userId },
    });
    await notify(tx, [
      {
        userId,
        type: 'counsel_verified',
        // A lawyer can be approved more than once (after a review reset), so the key carries the minute.
        dedupeKey: `counsel_verified:${new Date().toISOString().slice(0, 16)}`,
      },
    ]);
  });
  revalidatePath('/', 'layout');

  return 'ok';
}

const RejectionValidation = z.object({
  userId: z.string().min(1),
  reason: z.enum(rejectReasons).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Rejects an application. The reason is kept and shown to the applicant; the account stays without access. The decision note is the
 * chosen reason in its own words, then any details staff added.
 * @param input - The applicant and the reason.
 * @param input.userId - The applicant's Clerk user id.
 * @param input.reason - One of the reasons staff pick from.
 * @param input.note - Details to add, or the whole reason when none is chosen.
 * @returns `note` when there is neither a reason nor details, or they are too long; otherwise `ok`.
 */
export async function rejectApplication(input: {
  userId: string;
  reason?: RejectReason;
  note?: string;
}): Promise<'ok' | 'note'> {
  const staff = await requireStaff();
  const parsed = RejectionValidation.safeParse(input);

  if (!parsed.success) {
    return 'note';
  }

  // The reason is written in the applicant's own language, which they saved; a route with no language in its address has none of its own.
  const [setting] = await db
    .select({ locale: userSettingSchema.locale })
    .from(userSettingSchema)
    .where(eq(userSettingSchema.userId, parsed.data.userId));
  const t = await getTranslations({ locale: emailLocale(setting?.locale), namespace: 'Staff' });
  const decisionNote = [
    parsed.data.reason && t(`app_reason_${parsed.data.reason}`),
    parsed.data.note,
  ]
    .filter(Boolean)
    .join(' ');

  if (decisionNote === '' || decisionNote.length > 500) {
    return 'note';
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(institutionApplicationSchema)
      .set({
        status: 'rejected',
        decidedBy: staff.id,
        decidedAt: new Date(),
        decisionNote,
      })
      .where(
        and(
          eq(institutionApplicationSchema.userId, parsed.data.userId),
          eq(institutionApplicationSchema.status, 'in_review'),
        ),
      )
      .returning({ userId: institutionApplicationSchema.userId });

    if (updated) {
      await recordStaffAction(tx, {
        actor: staffActor(staff),
        action: 'application_rejected',
        target: { type: 'application', id: updated.userId },
      });
      await notify(tx, [
        {
          userId: updated.userId,
          type: 'application_rejected',
          dedupeKey: `application_rejected:${updated.userId}:${new Date().toISOString().slice(0, 16)}`,
        },
      ]);
    }
  });
  revalidatePath('/', 'layout');

  return 'ok';
}

/** What a batch did: how many it changed and how many it left alone because they had changed or could not be done. */
export type BulkResult = { done: number; skipped: number };

const ids = z.array(z.uuid()).min(1).max(100);

type Staff = Awaited<ReturnType<typeof requireStaff>>;

/**
 * Runs one change over a list of claims in a single transaction, one after another, and counts how many it changed. Each change
 * may read what the one before wrote (the first accepted claim for a platform opens its case), so they run in order.
 * @param claimIds - The claims.
 * @param change - The change for one claim; true when it changed it, false when it was no longer applicable.
 * @returns How many were changed.
 */
async function runBatch(
  claimIds: string[],
  change: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    claimId: string,
  ) => Promise<boolean>,
) {
  const results = await db.transaction(async (tx) => {
    const changed: boolean[] = [];

    for (const claimId of claimIds) {
      // oxlint-disable-next-line no-await-in-loop
      changed.push(await change(tx, claimId));
    }

    return changed;
  });
  revalidatePath('/', 'layout');

  return results.filter(Boolean).length;
}

/**
 * Confirms the video or files a person added to show the wallet is theirs, as part of accepting their claim. A wallet not already
 * confirmed by a signature is confirmed as checked by staff. Nothing is sent about it: the person hears that the claim was accepted.
 * @param tx - The transaction.
 * @param staff - The staff member.
 * @param claim - The claim and where its proof stands.
 */
async function confirmWalletProof(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  staff: Staff,
  claim: Pick<
    typeof claimSchema.$inferSelect,
    'id' | 'ownership' | 'reviewRequestedAt' | 'reviewedAt'
  >,
) {
  if (!claim.reviewRequestedAt || claim.reviewedAt) {
    return;
  }

  const confirming = claim.ownership !== 'signed';

  await tx
    .update(claimSchema)
    .set({
      reviewedAt: new Date(),
      reviewNote: null,
      ...(confirming && { ownership: 'signed', ownershipMethod: 'staff', signedAt: new Date() }),
    })
    .where(eq(claimSchema.id, claim.id));
  await recordStaffAction(tx, {
    actor: staffActor(staff),
    action: 'ownership_confirmed',
    target: { type: 'claim', id: claim.id },
    details: { method: confirming ? 'staff' : 'signature' },
  });
}

/**
 * Validates one sent claim inside a transaction: staff have checked it and the evidence the person added, including any proof of
 * the wallet, which is confirmed with it. It only works on a claim that was sent and not validated yet, and it tells the person.
 * A rejected claim can be validated too, which lifts its rejection.
 * @param tx - The transaction.
 * @param staff - The staff member.
 * @param claimId - The claim.
 * @returns True when it was validated; false when it was no longer waiting.
 */
async function validateOne(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  staff: Staff,
  claimId: string,
) {
  const [claim] = await tx
    .update(claimSchema)
    // A rejected claim can be accepted after all, in case it was rejected by mistake; its rejection is lifted.
    .set({ validatedAt: new Date(), rejectedAt: null, rejectionNote: null })
    .where(
      and(
        eq(claimSchema.id, claimId),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.validatedAt),
      ),
    )
    .returning({
      userId: claimSchema.userId,
      platformKey: claimSchema.platformKey,
      platformName: claimSchema.platformName,
      ownership: claimSchema.ownership,
      reviewRequestedAt: claimSchema.reviewRequestedAt,
      reviewedAt: claimSchema.reviewedAt,
    });

  if (!claim) {
    return false;
  }

  await confirmWalletProof(tx, staff, { id: claimId, ...claim });

  // The first confirmed claim for a platform opens its case; more of them move it on.
  const caseId = await addConfirmedClaim(tx, claim);

  await recordStaffAction(tx, {
    actor: staffActor(staff),
    action: 'claim_validated',
    target: { type: 'claim', id: claimId },
  });
  await notify(tx, [
    {
      userId: claim.userId,
      type: 'claim_validated',
      dedupeKey: `claim_validated:${claimId}`,
      data: { claimId },
    },
    ...(caseId
      ? [
          {
            userId: claim.userId,
            type: 'claim_in_case' as const,
            dedupeKey: `claim_in_case:${caseId}`,
            data: { caseId },
          },
        ]
      : []),
  ]);

  return true;
}

/**
 * Validates sent claims: one or a selection of up to 100. A claim for a wallet that another person has proved they control, when
 * this claim has not proved it, is refused and counted as skipped, as is one that was validated in the meantime. The rest are
 * validated, any video or files they added for the wallet are confirmed with them, and each person is told.
 * @param claimIds - The claims.
 * @returns How many were validated and how many were skipped.
 */
export async function validateClaims(claimIds: string[]): Promise<BulkResult> {
  const staff = await requireStaff();
  const parsed = ids.safeParse(claimIds);

  if (!parsed.success) {
    return { done: 0, skipped: 0 };
  }

  // A wallet someone else has already proved they control cannot be confirmed for a claim that has not proved it.
  const found = await db.select().from(claimSchema).where(inArray(claimSchema.id, parsed.data));
  const signals = await signalsFor(found);
  const blocked = new Set(
    found
      .filter(
        (claim) =>
          claim.ownership !== 'signed' &&
          signals.get(claim.id)?.includes('wallet_signed_elsewhere'),
      )
      .map((claim) => claim.id),
  );
  const allowed = parsed.data.filter((claimId) => !blocked.has(claimId));
  const done = await runBatch(
    allowed,
    async (tx, claimId) => await validateOne(tx, staff, claimId),
  );
  await refreshStoriesForClaims(allowed);

  return { done, skipped: parsed.data.length - done };
}

const DeclineProofValidation = z.object({
  claimId: z.uuid(),
  note: z.string().trim().min(1).max(500),
});

/**
 * Turns down the video and files a person added for their wallet and asks for new ones, while the claim stays in the queue. Their
 * files are deleted and their link forgotten so they are not kept, and the reason is shown to them on the claim. A wallet confirmed
 * by signature stays confirmed. It only works on a claim still waiting with proof nobody has looked at.
 * @param input - The claim and the reason.
 * @param input.claimId - The claim.
 * @param input.note - Why the proof was not enough.
 * @returns How many were changed and skipped, or `error` when the claim or the reason is missing.
 */
export async function declineWalletProof(input: {
  claimId: string;
  note: string;
}): Promise<BulkResult & { error?: 'note' }> {
  const staff = await requireStaff();
  const parsed = DeclineProofValidation.safeParse(input);

  if (!parsed.success) {
    return { done: 0, skipped: 0, error: 'note' };
  }

  const { claimId, note } = parsed.data;
  const done = await runBatch([claimId], async (tx) => {
    const [claim] = await tx
      .select({ ownership: claimSchema.ownership })
      .from(claimSchema)
      .where(
        and(
          eq(claimSchema.id, claimId),
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
          isNotNull(claimSchema.reviewRequestedAt),
          isNull(claimSchema.reviewedAt),
        ),
      );

    if (!claim) {
      return false;
    }

    await tx.delete(claimProofSchema).where(eq(claimProofSchema.claimId, claimId));
    await tx
      .update(claimSchema)
      .set({
        ownership: claim.ownership === 'review' ? 'unsigned' : claim.ownership,
        reviewNote: note,
        reviewVideoUrl: null,
        proofNote: null,
        reviewRequestedAt: null,
      })
      .where(eq(claimSchema.id, claimId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'ownership_declined',
      target: { type: 'claim', id: claimId },
    });

    return true;
  });

  return { done, skipped: 1 - done };
}

/**
 * Marks sent claims as in review: a member of staff has started on them. The person sees it on the claim and in the app. It only
 * works on a claim that is sent, not yet in review and not settled; any other is skipped.
 * @param claimIds - The claims.
 * @returns How many were changed and how many were skipped.
 */
export async function startClaimReviews(claimIds: string[]): Promise<BulkResult> {
  const staff = await requireStaff();
  const parsed = ids.safeParse(claimIds);

  if (!parsed.success) {
    return { done: 0, skipped: 0 };
  }

  const done = await runBatch(parsed.data, async (tx, claimId) => {
    const [claim] = await tx
      .update(claimSchema)
      .set({ staffReviewStartedAt: new Date() })
      .where(
        and(
          eq(claimSchema.id, claimId),
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
          isNull(claimSchema.staffReviewStartedAt),
        ),
      )
      .returning({ userId: claimSchema.userId });

    if (!claim) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'claim_review_started',
      target: { type: 'claim', id: claimId },
    });
    await notify(tx, [
      {
        userId: claim.userId,
        type: 'claim_in_review',
        dedupeKey: `claim_in_review:${claimId}`,
        data: { claimId },
      },
    ]);

    return true;
  });

  return { done, skipped: parsed.data.length - done };
}

const RejectClaimsValidation = z.object({ claimIds: ids, note: z.string().trim().min(1).max(500) });

/**
 * Rejects sent claims: one or a selection of up to 100, all with the same reason, which each person sees on their claim and in an
 * email. A rejected claim leaves the queue and never joins a case.
 * A claim already accepted can be rejected too, in case it was accepted by mistake: it is taken back out of its case. A claim
 * already rejected is skipped.
 * @param input - The claims and the reason.
 * @param input.claimIds - The claims.
 * @param input.note - Why they were rejected.
 * @returns How many were changed and skipped, or `error` when the reason is missing.
 */
export async function rejectClaims(input: {
  claimIds: string[];
  note: string;
}): Promise<BulkResult & { error?: 'note' }> {
  const staff = await requireStaff();
  const parsed = RejectClaimsValidation.safeParse(input);

  if (!parsed.success) {
    return { done: 0, skipped: 0, error: 'note' };
  }

  const { claimIds, note } = parsed.data;
  const done = await runBatch(claimIds, async (tx, claimId) => {
    const [before] = await tx
      .select({ validatedAt: claimSchema.validatedAt })
      .from(claimSchema)
      .where(eq(claimSchema.id, claimId));
    // Clearing `validatedAt` takes an accepted claim back out of the case counts, which read it.
    const [claim] = await tx
      .update(claimSchema)
      .set({ rejectedAt: new Date(), rejectionNote: note, validatedAt: null })
      .where(
        and(
          eq(claimSchema.id, claimId),
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.rejectedAt),
        ),
      )
      .returning({ userId: claimSchema.userId });

    if (!claim) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'claim_rejected',
      target: { type: 'claim', id: claimId },
      ...(before?.validatedAt && { details: { was: 'accepted' } }),
    });
    await notify(tx, [
      {
        userId: claim.userId,
        type: 'claim_rejected',
        dedupeKey: `claim_rejected:${claimId}`,
        data: { claimId },
      },
    ]);

    return true;
  });
  await refreshStoriesForClaims(claimIds);

  return { done, skipped: claimIds.length - done };
}

const blankToNull = (value: FormDataEntryValue | null) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Reads one alleged actor from a form and checks it.
 * @param formData - The form with `name`, `role`, `roleNote`, `jurisdiction` and `notes`.
 * @returns The actor, or the names of what failed: `words`, `role`, `jurisdictions` or `operators`.
 */
function parseOperator(formData: FormData) {
  const parsed = OperatorsValidation.safeParse([
    {
      name: blankToNull(formData.get('name')) ?? '',
      role: blankToNull(formData.get('role')),
      roleNote:
        blankToNull(formData.get('role')) === 'other'
          ? blankToNull(formData.get('roleNote'))
          : null,
      jurisdiction: blankToNull(formData.get('jurisdiction')),
      notes: blankToNull(formData.get('notes')),
    },
  ]);

  if (parsed.success && parsed.data[0]) {
    return { row: parsed.data[0] };
  }

  const issues = parsed.success ? [] : parsed.error.issues;

  if (issues.some((issue) => issue.message === 'forbidden_words')) {
    return { problems: ['words'] };
  }

  if (issues.some((issue) => issue.path.includes('roleNote'))) {
    return { problems: ['role'] };
  }

  return {
    problems: issues.some((issue) => issue.path.includes('jurisdiction'))
      ? ['jurisdictions']
      : ['operators'],
  };
}

/**
 * Adds one person or group the claimants allege is behind a platform, to the end of the case's list. The list has no limit. The
 * text must keep to the house language, because it records an allegation and never declares fraud.
 * @param caseId - The case id.
 * @param formData - The submitted form, with `name`, `role`, `jurisdiction` and `notes`.
 * @returns The names of the fields that failed: `words` when the text declares fraud, `operators` when the name is missing or a
 *   field is too long, `jurisdictions` when it is not a known jurisdiction, `case` when the case is not found.
 */
export async function addCaseOperator(caseId: string, formData: FormData) {
  const staff = await requireStaff();
  const parsed = parseOperator(formData);

  if (parsed.problems !== undefined) {
    return parsed.problems;
  }

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const found = await db.transaction(async (tx) => {
    const updated = await tx
      .update(caseSchema)
      .set({
        operatorRows: sql`${caseSchema.operatorRows} || ${JSON.stringify([parsed.row])}::jsonb`,
      })
      .where(eq(caseSchema.id, caseId))
      .returning({ id: caseSchema.id });

    if (updated.length === 0) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_operators_saved',
      target: { type: 'case', id: caseId },
    });

    return true;
  });
  revalidatePath('/', 'layout');

  return found ? [] : ['case'];
}

/**
 * Changes one alleged actor of a case, by its place in the list. The text must keep to the house language.
 * @param caseId - The case id.
 * @param index - The row's place in the list, from 0.
 * @param formData - The submitted form, as for `addCaseOperator`.
 * @returns The names of what failed, as for `addCaseOperator`, or `case` when there is no such row; none when saved.
 */
export async function updateCaseOperator(caseId: string, index: number, formData: FormData) {
  const staff = await requireStaff();
  const parsed = parseOperator(formData);

  if (parsed.problems !== undefined) {
    return parsed.problems;
  }

  if (!z.uuid().safeParse(caseId).success || !Number.isInteger(index) || index < 0) {
    return ['case'];
  }

  const found = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ rows: caseSchema.operatorRows })
      .from(caseSchema)
      .where(eq(caseSchema.id, caseId))
      .for('update');

    if (!current || index >= current.rows.length) {
      return false;
    }

    await tx
      .update(caseSchema)
      .set({ operatorRows: current.rows.map((row, place) => (place === index ? parsed.row : row)) })
      .where(eq(caseSchema.id, caseId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_operators_saved',
      target: { type: 'case', id: caseId },
    });

    return true;
  });
  revalidatePath('/', 'layout');

  return found ? [] : ['case'];
}

/**
 * Removes one person or group from the case's list.
 * @param caseId - The case id.
 * @param index - The row's place in the list, from 0.
 */
export async function removeCaseOperator(caseId: string, index: number) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success || !Number.isInteger(index) || index < 0) {
    return;
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ rows: caseSchema.operatorRows })
      .from(caseSchema)
      .where(eq(caseSchema.id, caseId))
      .for('update');

    if (!current || index >= current.rows.length) {
      return;
    }

    await tx
      .update(caseSchema)
      .set({ operatorRows: current.rows.filter((_, place) => place !== index) })
      .where(eq(caseSchema.id, caseId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_operators_saved',
      target: { type: 'case', id: caseId },
    });
  });
  revalidatePath('/', 'layout');
}

/**
 * Moves a case between the stages staff control: building and enough evidence.
 * @param caseId - The case id.
 * @param status - The new status.
 */
export async function setCaseStatus(caseId: string, status: string) {
  const staff = await requireStaff();
  const parsed = z.enum(caseStatuses).safeParse(status);

  if (!parsed.success) {
    return;
  }

  const next = parsed.data;
  await db.transaction(async (tx) => {
    const [found] = await tx.select().from(caseSchema).where(eq(caseSchema.id, caseId));

    if (!found || found.status === next) {
      return;
    }

    // A case cannot be sealed without a report: sealing says the evidence file is finished.
    if (next === 'sealed') {
      const [report] = await tx
        .select({ id: caseReportSchema.id })
        .from(caseReportSchema)
        .where(eq(caseReportSchema.caseId, caseId))
        .limit(1);

      if (!report) {
        return;
      }
    }

    await tx.update(caseSchema).set({ status: next }).where(eq(caseSchema.id, caseId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_status_set',
      target: { type: 'case', id: caseId },
      details: { status: next },
    });

    if (next === 'sealed') {
      await recordCaseEvent(tx, caseId, 'case_sealed');
    }

    // Sealing is the one stage people are told about: claimants hear their evidence is final, and lawyers hear it can be taken.
    if (next === 'sealed') {
      const [claimants, counsel] = await Promise.all([
        claimantIds(tx, found.platformKey),
        verifiedCounselIds(tx),
      ]);
      await notify(tx, [
        ...claimants.map((userId) => ({
          userId,
          type: 'case_sealed' as const,
          dedupeKey: `case_sealed:${caseId}`,
          data: { caseId },
        })),
        ...counsel.map((userId) => ({
          userId,
          type: 'case_ready_for_counsel' as const,
          dedupeKey: `case_ready_for_counsel:${caseId}`,
          data: { caseId },
        })),
      ]);
    }
  });
  revalidatePath('/', 'layout');
}

/**
 * Puts a failed email back in the queue to be tried again, for when the cause (a wrong setting, a down server) is fixed.
 * @param id - The message id.
 */
export async function retryMail(id: string) {
  const staff = await requireStaff();
  await db
    .update(emailMessageSchema)
    .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null })
    .where(eq(emailMessageSchema.id, id));
  await recordStaffAction(db, {
    actor: staffActor(staff),
    action: 'mail_retried',
    target: { type: 'email', id },
  });
  revalidatePath('/', 'layout');
}

/**
 * Lets mail go to an address again, after the reason it was stopped is fixed.
 * @param email - The address.
 */
export async function allowMail(email: string) {
  const staff = await requireStaff();
  await unsuppress(email);
  // The address itself is a person's detail, so the record only says that an address was allowed.
  await recordStaffAction(db, { actor: staffActor(staff), action: 'mail_allowed' });
  revalidatePath('/', 'layout');
}

/**
 * Forgets the signed-in staff member's own Sandworm login. Each person can only disconnect themselves.
 */
export async function disconnectSandworm() {
  const staff = await requireStaff();
  await deleteConnection(staff.id);
  await recordStaffAction(db, { actor: staffActor(staff), action: 'sandworm_disconnected' });
  revalidatePath('/', 'layout');
}

/**
 * Adds a public statement the platform made to a case, for a check to compare with what the chain shows.
 * @param caseId - The case id.
 * @param formData - The form with `kind`, `text` and `sourceUrl`.
 * @returns The names of what failed: `case`, `invalid`, `words` (a wording the report would refuse) or `full`; none when added.
 */
export async function addPlatformStatement(caseId: string, formData: FormData) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const field = (name: string) => {
    const entry = formData.get(name);

    return typeof entry === 'string' && entry.trim() !== '' ? entry : undefined;
  };

  const result = await addStatement({
    caseId,
    input: {
      kind: field('kind'),
      text: field('text'),
      sourceUrl: field('sourceUrl'),
    },
    actor: staffActor(staff),
  });
  await refreshCaseStory(caseId);
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

/**
 * Changes a platform statement of a case that nobody has planned research for.
 * @param caseId - The case id.
 * @param statementId - The statement id.
 * @param formData - The form with `kind`, `text` and `sourceUrl`.
 * @returns The names of what failed: `case`, `invalid`, `words`, `missing` or `researched`; none when saved.
 */
export async function updatePlatformStatement(
  caseId: string,
  statementId: string,
  formData: FormData,
) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(statementId).success) {
    return ['case'];
  }

  const field = (name: string) => {
    const entry = formData.get(name);

    return typeof entry === 'string' && entry.trim() !== '' ? entry : undefined;
  };

  const result = await updateStatement({
    caseId,
    id: statementId,
    input: { kind: field('kind'), text: field('text'), sourceUrl: field('sourceUrl') },
    actor: staffActor(staff),
  });
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

/**
 * Removes a platform statement from a case.
 * @param caseId - The case id.
 * @param statementId - The statement id.
 */
export async function removePlatformStatement(caseId: string, statementId: string) {
  const staff = await requireStaff();

  if (z.uuid().safeParse(caseId).success && z.uuid().safeParse(statementId).success) {
    await removeStatement({ caseId, id: statementId, actor: staffActor(staff) });
    await refreshCaseStory(caseId);
    revalidatePath('/', 'layout');
  }
}

/**
 * Gives the browser a one-minute address to upload an evidence file to IPFS, so the file never passes through our server.
 * @param fileName - The name of the file about to be uploaded.
 * @returns The upload address, or why there is none: `off` (Pinata is not set up) or `failed`.
 */
export async function startEvidenceUpload(fileName: string) {
  await requireStaff();

  const url = await signUpload(fileName.slice(0, 200));

  return url === 'off' || url === 'failed' ? { error: url } : { url };
}

/**
 * Reads one alleged action from a form and checks it.
 * @param formData - The form with `title` and optionally `kind`, `occurredOn`, `jurisdiction` and `note`.
 * @returns The action, or the names of what failed: `words`, `jurisdictions` or `invalid`.
 */
function parseAction(formData: FormData) {
  const parsed = ActionValidation.safeParse({
    kind: blankToNull(formData.get('kind')) ?? undefined,
    title: blankToNull(formData.get('title')) ?? undefined,
    note: blankToNull(formData.get('note')) ?? undefined,
    occurredOn: blankToNull(formData.get('occurredOn')) ?? undefined,
    jurisdiction: blankToNull(formData.get('jurisdiction')) ?? undefined,
  });

  if (parsed.success) {
    return { action: parsed.data };
  }

  const { issues } = parsed.error;

  if (issues.some((issue) => issue.message === 'forbidden_words')) {
    return { problems: ['words'] };
  }

  return {
    problems: issues.some((issue) => issue.path.includes('jurisdiction'))
      ? ['jurisdictions']
      : ['invalid'],
  };
}

/**
 * Adds an action the claimants allege against a case's suspected people and groups: what was done, its kind, and optionally when,
 * where and notes. The text must keep to the house language, because it records an allegation and never declares fraud.
 * @param caseId - The case id.
 * @param formData - The submitted form, with `kind`, `title` and optionally `occurredOn`, `jurisdiction` and `note`.
 * @returns The names of what failed: `words` when the text declares fraud, `jurisdictions` when it is not a known jurisdiction,
 *   `invalid` for anything else, `case` when the case is not found; none when added.
 */
export async function addCaseAction(caseId: string, formData: FormData) {
  const staff = await requireStaff();
  const parsed = parseAction(formData);

  if (parsed.problems !== undefined) {
    return parsed.problems;
  }

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const found = await db.transaction(async (tx) => {
    const [exists] = await tx
      .select({ id: caseSchema.id })
      .from(caseSchema)
      .where(eq(caseSchema.id, caseId));

    if (!exists) {
      return false;
    }

    const [added] = await tx
      .insert(caseActionSchema)
      .values({ ...parsed.action, caseId, createdBy: staff.id })
      .returning({ id: caseActionSchema.id });

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_action_added',
      target: { type: 'case', id: caseId },
      details: { action: added?.id ?? '' },
    });

    return true;
  });
  revalidatePath('/', 'layout');

  return found ? [] : ['case'];
}

/**
 * Changes an alleged action of a case. Whatever the form leaves blank is cleared. The text must keep to the house language.
 * @param caseId - The case id.
 * @param actionId - The action id.
 * @param formData - The submitted form, as for `addCaseAction`.
 * @returns The names of what failed, as for `addCaseAction`; none when saved.
 */
export async function updateCaseAction(caseId: string, actionId: string, formData: FormData) {
  const staff = await requireStaff();
  const parsed = parseAction(formData);

  if (parsed.problems !== undefined) {
    return parsed.problems;
  }

  if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(actionId).success) {
    return ['case'];
  }

  const found = await db.transaction(async (tx) => {
    const updated = await tx
      .update(caseActionSchema)
      .set({
        kind: parsed.action.kind ?? null,
        title: parsed.action.title,
        note: parsed.action.note ?? null,
        occurredOn: parsed.action.occurredOn ?? null,
        jurisdiction: parsed.action.jurisdiction ?? null,
      })
      .where(and(eq(caseActionSchema.id, actionId), eq(caseActionSchema.caseId, caseId)))
      .returning({ id: caseActionSchema.id });

    if (updated.length === 0) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_action_updated',
      target: { type: 'case', id: caseId },
      details: { action: actionId },
    });

    return true;
  });
  revalidatePath('/', 'layout');

  return found ? [] : ['case'];
}

/**
 * Removes an alleged action from a case. The evidence attached to it stays on the case, no longer attached to anything.
 * @param caseId - The case id.
 * @param actionId - The action id.
 */
export async function removeCaseAction(caseId: string, actionId: string) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(actionId).success) {
    return;
  }

  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(caseActionSchema)
      .where(and(eq(caseActionSchema.id, actionId), eq(caseActionSchema.caseId, caseId)))
      .returning({ id: caseActionSchema.id });

    if (removed.length === 0) {
      return;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_action_removed',
      target: { type: 'case', id: caseId },
      details: { action: actionId },
    });
  });
  revalidatePath('/', 'layout');
}

/**
 * Adds evidence to a case: a video, image or document already pinned to IPFS, a link, or a wallet or transaction. Only the CID is kept.
 * @param caseId - The case id.
 * @param formData - The form with `type`, `title`, the fields that type needs, `lawful`, and `pinId` for a video, image or document.
 * @returns The name of what failed: `case`, `invalid`, `words`, `full`, `file`, `statement` or `taken`; none when added.
 */
export async function addCaseEvidence(caseId: string, formData: FormData) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const field = (name: string) => {
    const entry = formData.get(name);

    return typeof entry === 'string' && entry.trim() !== '' ? entry : undefined;
  };

  const result = await addEvidence({
    caseId,
    input: {
      type: field('type'),
      title: field('title'),
      note: field('note'),
      sourceUrl: field('sourceUrl'),
      capturedOn: field('capturedOn'),
      chain: field('chain'),
      reference: field('reference'),
      statementId: field('statementId'),
      actionId: field('actionId'),
      lawful: formData.get('lawful') === 'on',
    },
    pinId: field('pinId') ?? null,
    actor: staffActor(staff),
  });
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

/**
 * Changes the details of evidence on a case. Its kind and its file cannot change.
 * @param caseId - The case id.
 * @param evidenceId - The evidence id.
 * @param formData - The form with `type` (unchanged), `title` and the fields that type needs.
 * @returns The name of what failed: `case`, `invalid`, `words`, `missing`, `type`, `statement` or `action`; none when saved.
 */
export async function updateCaseEvidence(caseId: string, evidenceId: string, formData: FormData) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(evidenceId).success) {
    return ['case'];
  }

  const field = (name: string) => {
    const entry = formData.get(name);

    return typeof entry === 'string' && entry.trim() !== '' ? entry : undefined;
  };

  const result = await updateEvidence({
    caseId,
    id: evidenceId,
    input: {
      type: field('type'),
      title: field('title'),
      note: field('note'),
      sourceUrl: field('sourceUrl'),
      capturedOn: field('capturedOn'),
      chain: field('chain'),
      reference: field('reference'),
      statementId: field('statementId'),
      actionId: field('actionId'),
    },
    actor: staffActor(staff),
  });
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

/**
 * Records the review of a piece of off-chain evidence.
 * @param caseId - The case id.
 * @param evidenceId - The evidence id.
 * @param formData - The form with `state` and `note`.
 * @returns The name of what failed: `case`, `invalid`, `words`, `missing` or `type`; none when saved.
 */
export async function reviewCaseEvidence(caseId: string, evidenceId: string, formData: FormData) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(evidenceId).success) {
    return ['case'];
  }

  const note = formData.get('note');
  const result = await reviewEvidence({
    caseId,
    id: evidenceId,
    input: {
      state: formData.get('state'),
      note: typeof note === 'string' && note.trim() !== '' ? note : undefined,
    },
    actor: staffActor(staff),
  });
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

/**
 * Removes evidence from a case and stops pinning its file.
 * @param caseId - The case id.
 * @param evidenceId - The evidence id.
 */
export async function removeCaseEvidence(caseId: string, evidenceId: string) {
  const staff = await requireStaff();

  if (z.uuid().safeParse(caseId).success && z.uuid().safeParse(evidenceId).success) {
    await removeEvidence({ caseId, id: evidenceId, actor: staffActor(staff) });
    revalidatePath('/', 'layout');
  }
}

/**
 * Approves the analysis brief for one statement of a case: the decision to spend the compute. Preflight runs again first, so a brief that no longer
 * passes is not approved. Only a person can do this; the assistant has no tool for it.
 * @param caseId - The case id.
 * @param statementId - The statement to research.
 * @returns `approved` with the run number, `blocked` with what stops it, or `missing` when there is no such case.
 */
export async function approveAnalysisBrief(caseId: string, statementId: string) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(statementId).success) {
    return { status: 'missing' as const };
  }

  const result = await approveBrief({ caseId, statementId, actor: staffActor(staff) });
  revalidatePath('/', 'layout');

  if (!result) {
    return { status: 'missing' as const };
  }

  return result.status === 'approved'
    ? { status: 'approved' as const, run: result.approved.run }
    : { status: 'blocked' as const, problems: result.problems };
}

/**
 * Saves a report for a case from the findings JSON an analysis produced. The text is checked against the report format and the
 * house language, hashed, and stored as a new version. Staff review it first: this is the last check before it is shown to
 * lawyers.
 * @param caseId - The case id.
 * @param formData - The form with `report` (the JSON).
 * @returns The problems found, or none when saved: `json`, `schema`, `words`, `table` (a test has no table), `loss` (the estimate
 *   has no dollar amount that can be read) or `case`.
 */
export async function saveCaseReport(caseId: string, formData: FormData) {
  const user = await requireStaff();

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const raw = formData.get('report');
  let json: unknown;

  // Pasted text may be anything, so parsing it is the one place a throw is expected.
  try {
    json = JSON.parse(typeof raw === 'string' ? raw : '');
  } catch {
    return ['json'];
  }

  const problem = await saveCheckedReport({ caseId, json, actor: staffActor(user) });

  if (problem) {
    return [problem];
  }

  await refreshCaseStory(caseId);
  revalidatePath('/', 'layout');

  return [];
}

/**
 * A person's yes or no to a report the assistant has reviewed. Yes publishes it as the case's report; no sends it back and it is
 * never shown. It is only for the staff area: no MCP tool can answer, so an assistant cannot approve its own report.
 * @param options - The report and the answer.
 * @param options.caseId - The case id.
 * @param options.run - The analysis run number.
 * @param options.version - The version of that analysis's report.
 * @param options.approve - True for yes, false for no.
 * @returns The names of what failed: `case` or `state` (the report is not waiting for a person); none when answered.
 */
export async function answerCaseReport(options: {
  caseId: string;
  run: number;
  version: number;
  approve: boolean;
}) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(options.caseId).success) {
    return ['case'];
  }

  const result = await answerReport({ ...options, actor: staffActor(staff) });
  await refreshCaseStory(options.caseId);
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

const ContactDecisionValidation = z.object({
  requestId: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Staff's yes or no to an organisation's request to contact the claimants of a case. A yes asks the claimants who agreed to be
 * asked; a no needs a reason, which the organisation reads. The decision is recorded in the staff audit.
 * @param input - The decision.
 * @param input.requestId - The request id.
 * @param input.approve - True for yes.
 * @param input.note - The reason for a no.
 * @returns `note` when a no has no reason or the reason is too long, `state` when the request is no longer waiting, else `ok`.
 */
export async function decideContactRequest(input: {
  requestId: string;
  approve: boolean;
  note?: string;
}): Promise<'ok' | 'note' | 'state'> {
  const staff = await requireStaff();
  const parsed = ContactDecisionValidation.safeParse(input);

  if (!parsed.success || (!parsed.data.approve && !parsed.data.note)) {
    return 'note';
  }

  const result = await decideRequest({ ...parsed.data, actor: staffActor(staff) });

  if (result.problem) {
    return 'state';
  }

  revalidatePath('/', 'layout');

  return 'ok';
}
