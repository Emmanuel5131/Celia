/**
 * Where a case stands with its research, in the words staff use: nothing is planned yet, the agent is working on a statement that
 * has no report, or every statement that was planned has a report.
 */
export type AnalysisStatus = 'needs_plan' | 'agent_working' | 'report_saved';

/**
 * Works out where a case stands from how many statements were planned and how many of those have a report. Each statement is
 * researched on its own, so a case is still working while any approved plan waits for its report, even when others are done.
 * @param counts - The statements with an approved plan and, of those, the ones with a saved report.
 * @param counts.planned - How many statements have an approved plan.
 * @param counts.reported - How many of them have a saved report.
 * @returns The status.
 */
export function analysisStatus(counts: { planned: number; reported: number }) {
  if (counts.planned > counts.reported) {
    return 'agent_working' as const;
  }

  return counts.reported > 0 ? ('report_saved' as const) : ('needs_plan' as const);
}
