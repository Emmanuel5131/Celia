import { isResearchable } from '@celia/core';
import { listApprovedBriefs } from '@/libs/analysis/Analysis';
import type { ApprovedBrief } from '@/libs/analysis/Analysis';
import { listStatements } from '@/libs/analysis/Statements';
import type { StoredStatement } from '@/libs/analysis/Statements';
import { getReport, listLatestReports } from '@/libs/cases/Reports';
import type { ReportView } from '@/libs/cases/Reports';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';
import { previewRows } from '@/utils/cases/Preview';

/**
 * Where one statement of the platform stands: nothing for the chain to show (`not_checkable`), nobody has planned research yet
 * (`not_researched`), a plan is approved and the report is not saved (`researching`), a report is saved but still being reviewed
 * (`in_review`, only in the staff area), or an approved report is saved (`reported`).
 */
type ResearchState = 'not_checkable' | 'not_researched' | 'researching' | 'in_review' | 'reported';

/** One statement of the platform with its research: the newest approved plan for it and the newest report of that plan. */
export type ResearchItem = {
  statement: StoredStatement;
  state: ResearchState;
  /** The newest approved plan for the statement. */
  plan: ApprovedBrief | null;
  /** The newest report of that plan. */
  report: ReportView | null;
};

function stateOf(
  kind: StoredStatement['kind'],
  plan: ApprovedBrief | null,
  report: ReportView | null,
): ResearchState {
  if (report) {
    return report.review === 'approved' ? 'reported' : 'in_review';
  }

  if (plan) {
    return 'researching';
  }

  return isResearchable(kind) ? 'not_researched' : 'not_checkable';
}

/**
 * Lists a case's research, one item for each statement the platform made, in the order they were entered. Each statement is
 * researched on its own, so each has its own plan, notebook and report.
 * @param caseId - The case id.
 * @param options - What to read.
 * @param options.inReview - Also count reports still being reviewed. Only the staff area sets it; everyone else sees approved
 *   reports only.
 * @returns The items.
 */
export async function listResearch(
  caseId: string,
  options: { inReview?: boolean } = {},
): Promise<ResearchItem[]> {
  const [statements, plans, reports] = await Promise.all([
    listStatements(caseId),
    listApprovedBriefs(caseId),
    listLatestReports(caseId, options),
  ]);

  return statements.map((statement) => {
    // The plans come newest first, so the first one for a statement is the one in force.
    const plan = plans.find((candidate) => candidate.statementId === statement.id) ?? null;
    const report = plan ? (reports.find((item) => item.analysisId === plan.id) ?? null) : null;
    return { statement, state: stateOf(statement.kind, plan, report), plan, report };
  });
}

/**
 * Tells whether a reader may open the report of one analysis. Someone who may not read every list sees the first rows of the
 * research only, so only the reports in those rows are theirs to open.
 * @param caseId - The case id.
 * @param run - The analysis run number.
 * @param access - How much of the case the reader may see.
 * @returns True when the reader may open it.
 */
export async function canOpenReport(caseId: string, run: number, access: CaseAccess) {
  if (access === 'full') {
    return true;
  }

  const items = await listResearch(caseId);

  return items
    .slice(0, previewRows)
    .some((item) => item.state === 'reported' && item.plan?.run === run);
}

/**
 * Finds one analysis by its run number, with the statement it checks and its newest report. A statement researched again has
 * several runs; each stays reachable.
 * @param caseId - The case id.
 * @param run - The analysis run number.
 * @returns The plan, its statement and its newest report, or null when no plan of the case has that run.
 */
export async function getAnalysisByRun(caseId: string, run: number) {
  const [plans, statements, report] = await Promise.all([
    listApprovedBriefs(caseId),
    listStatements(caseId),
    getReport(caseId, { run }),
  ]);
  const plan = plans.find((candidate) => candidate.run === run);
  const statement = statements.find((candidate) => candidate.id === plan?.statementId);

  return plan && statement ? { plan, statement, report } : null;
}
