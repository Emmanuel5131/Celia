import { describe, expect, it } from 'vitest';
import { analysisStatus } from './Status';

describe(analysisStatus, () => {
  it('needs a plan when nothing is planned', () => {
    expect(analysisStatus({ planned: 0, reported: 0 })).toBe('needs_plan');
  });

  it('waits for the agent once a plan is approved', () => {
    expect(analysisStatus({ planned: 1, reported: 0 })).toBe('agent_working');
  });

  it('has a saved report when every plan has one', () => {
    expect(analysisStatus({ planned: 2, reported: 2 })).toBe('report_saved');
  });

  it('keeps waiting while one statement has no report yet', () => {
    expect(analysisStatus({ planned: 3, reported: 2 })).toBe('agent_working');
  });
});
