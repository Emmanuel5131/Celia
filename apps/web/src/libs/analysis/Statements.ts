import type { PlatformStatement } from '@celia/core';
import { and, asc, count, eq } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { caseStatementSchema } from '@/models/Schema';
import { maxStatements, StatementValidation } from '@/validations/StatementValidation';

/** A statement as staff see it, with the id they remove it by. */
export type StoredStatement = PlatformStatement & { id: string };

/**
 * Lists a case's platform statements, oldest first.
 * @param caseId - The case id.
 * @returns The statements.
 */
export async function listStatements(caseId: string): Promise<StoredStatement[]> {
  const rows = await db
    .select()
    .from(caseStatementSchema)
    .where(eq(caseStatementSchema.caseId, caseId))
    .orderBy(asc(caseStatementSchema.createdAt));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    text: row.text,
    sourceUrl: row.sourceUrl,
    ...(row.saidOn && { saidOn: row.saidOn }),
  }));
}

/**
 * Adds a platform statement to a case and records it in the staff audit, in one transaction. The audit holds the kind only, never
 * the text.
 * @param options - What to add.
 * @param options.caseId - The case id.
 * @param options.input - The statement as entered, checked here.
 * @param options.actor - The staff member.
 * @returns `ok`, or why not: `invalid`, `words` (a wording the report refuses) or `full`.
 */
export async function addStatement(options: {
  caseId: string;
  input: unknown;
  actor: { id: string; email: string | null };
}) {
  const parsed = StatementValidation.safeParse(options.input);

  if (!parsed.success) {
    return parsed.error.issues.some((issue) => issue.message === 'forbidden_words')
      ? ('words' as const)
      : ('invalid' as const);
  }

  return await db.transaction(async (tx) => {
    const [held] = await tx
      .select({ total: count() })
      .from(caseStatementSchema)
      .where(eq(caseStatementSchema.caseId, options.caseId));

    if ((held?.total ?? 0) >= maxStatements) {
      return 'full' as const;
    }

    await tx.insert(caseStatementSchema).values({
      caseId: options.caseId,
      kind: parsed.data.kind,
      text: parsed.data.text,
      sourceUrl: parsed.data.sourceUrl,
      saidOn: parsed.data.saidOn ?? null,
      createdBy: options.actor.id,
    });
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'statement_added',
      target: { type: 'case', id: options.caseId },
      details: { kind: parsed.data.kind },
    });

    return 'ok' as const;
  });
}

/**
 * Removes a platform statement from a case and records it in the staff audit.
 * @param options - What to remove.
 * @param options.caseId - The case id, so a statement can only be removed from its own case.
 * @param options.id - The statement id.
 * @param options.actor - The staff member.
 * @returns True when a statement was removed.
 */
export async function removeStatement(options: {
  caseId: string;
  id: string;
  actor: { id: string; email: string | null };
}) {
  return await db.transaction(async (tx) => {
    const removed = await tx
      .delete(caseStatementSchema)
      .where(
        and(eq(caseStatementSchema.id, options.id), eq(caseStatementSchema.caseId, options.caseId)),
      )
      .returning({ id: caseStatementSchema.id });

    if (removed.length === 0) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'statement_removed',
      target: { type: 'case', id: options.caseId },
    });

    return true;
  });
}
