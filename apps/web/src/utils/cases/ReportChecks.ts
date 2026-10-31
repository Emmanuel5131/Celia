import type { CheckResult, Report } from '@/validations/ReportValidation';

/** One check of a report as a table row: what the platform said, the result and what the chain shows. */
export type CheckRow = {
  /** The check's place in the report, which names its row. */
  id: string;
  claim: string;
  result: CheckResult;
  evidence: string;
  /** Links outside Celia that back the check up. */
  proof: { label: string; url: string }[];
};

/**
 * The checks of a report as table rows, so the case page and the staff view show them the same way. A report comes from one
 * notebook, so a row does not link anywhere: the report names that notebook once.
 * @param report - The report's checks.
 * @returns One row for each check, in the order of the report.
 */
export function checkRows(report: Pick<Report, 'checks'>): CheckRow[] {
  return report.checks.map((check, index) => ({
    id: String(index),
    claim: check.claim,
    result: check.result,
    evidence: check.evidence,
    proof: check.proof ?? [],
  }));
}
