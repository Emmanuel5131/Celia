/**
 * Where a case stands with its analysis, in the words staff use: it needs a plan, the agent is working on an approved plan, or a
 * report is saved.
 */
export type AnalysisStatus = 'needs_plan' | 'agent_working' | 'report_saved';

/**
 * Works out where a case stands from two times. A plan approved after the newest report means the agent is working on a new run,
 * even when an older report exists. A report with no plan (saved by hand, or before plans existed) counts as saved.
 * @param times - When the newest plan was approved and when the newest report was saved, as ISO times, or null for neither.
 * @param times.approvedAt - The newest approval.
 * @param times.reportAt - The newest report.
 * @returns The status.
 */
export function analysisStatus(times: { approvedAt: string | null; reportAt: string | null }) {
  if (
    times.approvedAt &&
    (!times.reportAt || new Date(times.reportAt) < new Date(times.approvedAt))
  ) {
    return 'agent_working' as const;
  }

  return times.reportAt ? ('report_saved' as const) : ('needs_plan' as const);
}
