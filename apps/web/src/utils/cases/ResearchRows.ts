import type { StatementKind } from '@celia/core';
import type { CheckResult } from '@/validations/ReportValidation';

/** Where a statement's research stands, as the table shows it. */
type RowState = 'not_checkable' | 'not_researched' | 'researching' | 'in_review' | 'reported';

/** One statement of the platform as a table row: what was said, where research stands, and the way to its page. */
export type ResearchRow = {
  id: string;
  text: string;
  sourceUrl: string;
  kind: StatementKind;
  state: RowState;
  /** The report's verdict on the statement, once there is a report. */
  result: CheckResult | null;
  /** Where its page is, when it has one. */
  href: string | null;
};

type ResearchSource = {
  statement: { id: string; text: string; sourceUrl: string; kind: StatementKind };
  state: RowState;
  plan: { run: number } | null;
  report: { snapshot: { checks: { result: CheckResult }[] } } | null;
};

/**
 * Turns a case's research into table rows, so the staff list and the case's analysis list show it the same way. A report holds
 * one check, which is the verdict on its statement.
 * @param items - The research of each statement.
 * @param hrefFor - Makes the page address from what the row needs; return null for a row with no page for this reader.
 * @returns One row for each statement, in the order they were entered.
 */
export function researchRows(
  items: ResearchSource[],
  hrefFor: (item: { statementId: string; run: number | null; state: RowState }) => string | null,
): ResearchRow[] {
  return items.map((item) => ({
    id: item.statement.id,
    text: item.statement.text,
    sourceUrl: item.statement.sourceUrl,
    kind: item.statement.kind,
    state: item.state,
    result: item.report?.snapshot.checks[0]?.result ?? null,
    href: hrefFor({
      statementId: item.statement.id,
      run: item.plan?.run ?? null,
      state: item.state,
    }),
  }));
}
