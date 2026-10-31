import { prepareAnalysis } from '@celia/core';
import type { Brief, PreflightProblem } from '@celia/core';
import { desc, eq, max } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { loadBriefInput } from '@/libs/analysis/Brief';
import { db } from '@/libs/DB';
import { caseAnalysisSchema } from '@/models/Schema';
import { commitmentHash } from '@/utils/analysis/Commitment';

/** A brief staff approved, as the staff page and the assistant see it. */
export type ApprovedBrief = {
  id: string;
  /** The statement it checks. Null for a plan approved before each statement had its own. */
  statementId: string | null;
  run: number;
  brief: Brief;
  commitment: string;
  approvedAt: string;
};

const toApproved = (row: typeof caseAnalysisSchema.$inferSelect): ApprovedBrief => ({
  id: row.id,
  statementId: row.statementId,
  run: row.run,
  brief: row.brief,
  commitment: row.commitment,
  approvedAt: row.approvedAt.toISOString(),
});

/**
 * Checks whether a case is ready for an analysis and builds the brief, without saving anything.
 * @param caseId - The case id.
 * @param statementId - The statement to research.
 * @returns The problems and the brief (null while anything blocks), or null when there is no such case or statement.
 */
export async function previewBrief(caseId: string, statementId: string) {
  const input = await loadBriefInput(caseId, statementId);

  return input ? prepareAnalysis(input) : null;
}

/**
 * Lists the briefs staff approved for a case, newest first.
 * @param caseId - The case id.
 * @returns The approved briefs.
 */
export async function listApprovedBriefs(caseId: string) {
  const rows = await db
    .select()
    .from(caseAnalysisSchema)
    .where(eq(caseAnalysisSchema.caseId, caseId))
    .orderBy(desc(caseAnalysisSchema.run));

  return rows.map(toApproved);
}

/**
 * Approves the brief for a case: the staff member's decision to spend the compute. Preflight runs again at this moment, so a
 * brief that no longer passes is not approved. The commitment is stored with the brief and the approval is written to the staff
 * audit, in one transaction. Approving is a person's step; no tool the assistant has can do it.
 * @param options - Who is approving what.
 * @param options.caseId - The case id.
 * @param options.statementId - The statement to research.
 * @param options.actor - The staff member.
 * @returns The approved brief, or the problems that stop it, or null when there is no such case.
 */
export async function approveBrief(options: {
  caseId: string;
  statementId: string;
  actor: { id: string; email: string | null };
}): Promise<
  | { status: 'approved'; approved: ApprovedBrief }
  | { status: 'blocked'; problems: PreflightProblem[] }
  | null
> {
  const prepared = await previewBrief(options.caseId, options.statementId);

  if (!prepared) {
    return null;
  }

  if (!prepared.brief) {
    return { status: 'blocked', problems: prepared.problems };
  }

  const { brief } = prepared;

  return await db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ run: max(caseAnalysisSchema.run) })
      .from(caseAnalysisSchema)
      .where(eq(caseAnalysisSchema.caseId, options.caseId));
    const run = (latest?.run ?? 0) + 1;

    const [row] = await tx
      .insert(caseAnalysisSchema)
      .values({
        caseId: options.caseId,
        statementId: options.statementId,
        run,
        brief,
        templateId: brief.template.id,
        templateVersion: brief.template.version,
        commitment: commitmentHash(brief),
        approvedBy: options.actor.id,
      })
      .returning();

    if (!row) {
      throw new Error('The approved brief was not saved');
    }

    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'analysis_brief_approved',
      target: { type: 'case', id: options.caseId },
      details: { run: String(run), template: brief.template.id, statement: options.statementId },
    });

    return { status: 'approved' as const, approved: toApproved(row) };
  });
}
