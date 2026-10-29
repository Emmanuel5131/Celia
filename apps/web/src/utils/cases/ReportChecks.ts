import type { CheckResult, Report } from '@/validations/ReportValidation';

/** One check of a report as a table row: what the platform said, the result, what the chain shows and what backs it. */
export type CheckRow = {
  /** The check's place in the report, which names its row. */
  id: string;
  claim: string;
  result: CheckResult;
  evidence: string;
  /** The tests that back the check, each with a link to its output. Empty when the check has no test yet. */
  tests: { id: string; title: string; href: string }[];
  /** Links outside Celia that back the check up. */
  proof: { label: string; url: string }[];
};

/**
 * The checks of a report as table rows, so the case page and the staff view show them the same way and staff can see which checks
 * have a test behind them and which still need research.
 * @param report - The report's checks and tests.
 * @param href - Makes the link to a test's output from its id.
 * @returns One row for each check, in the order of the report.
 */
export function checkRows(
  report: Pick<Report, 'checks' | 'tests'>,
  href: (testId: string) => string,
): CheckRow[] {
  return report.checks.map((check, index) => ({
    id: String(index),
    claim: check.claim,
    result: check.result,
    evidence: check.evidence,
    tests: (check.tests ?? []).map((id) => ({
      id,
      title: report.tests.find((test) => test.id === id)?.title ?? id,
      href: href(id),
    })),
    proof: check.proof ?? [],
  }));
}
