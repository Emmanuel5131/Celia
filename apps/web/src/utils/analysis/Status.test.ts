import { describe, expect, it } from 'vitest';
import { analysisStatus } from './Status';

describe(analysisStatus, () => {
  it('needs a plan when there is neither a plan nor a report', () => {
    expect(analysisStatus({ approvedAt: null, reportAt: null })).toBe('needs_plan');
  });

  it('waits for the agent once a plan is approved', () => {
    expect(analysisStatus({ approvedAt: '2026-10-31T10:00:00Z', reportAt: null })).toBe(
      'agent_working',
    );
  });

  it('has a saved report when it was saved after the plan', () => {
    expect(
      analysisStatus({ approvedAt: '2026-10-31T10:00:00Z', reportAt: '2026-10-31T11:00:00Z' }),
    ).toBe('report_saved');
  });

  it('waits for the agent again when a new plan follows an older report', () => {
    expect(
      analysisStatus({ approvedAt: '2026-10-31T12:00:00Z', reportAt: '2026-10-31T11:00:00Z' }),
    ).toBe('agent_working');
  });

  it('counts a report with no plan as saved', () => {
    expect(analysisStatus({ approvedAt: null, reportAt: '2026-10-31T11:00:00Z' })).toBe(
      'report_saved',
    );
  });
});
