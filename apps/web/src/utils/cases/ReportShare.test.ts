import { describe, expect, it } from 'vitest';
import { shareReport } from './ReportShare';

const report = {
  analysisId: 'a1',
  run: 2,
  version: 3,
  hash: `0x${'ab'.repeat(32)}`,
  savedAt: '2026-10-31T10:00:00Z',
  review: 'approved',
  agentReview: {
    verdict: 'concerns',
    message: 'private note for staff',
    at: '2026-10-31T09:00:00Z',
  },
  snapshot: { headline: 'The chain shows money in and out.' },
};

describe(shareReport, () => {
  it('keeps the findings, their hash and when they were saved', () => {
    expect(shareReport(report)).toStrictEqual({
      run: 2,
      version: 3,
      snapshot: report.snapshot,
      hash: report.hash,
      savedAt: report.savedAt,
    });
  });

  it('leaves out the assistant note and the plan id', () => {
    const shared = JSON.stringify(shareReport(report));

    expect(shared).not.toContain('private note');
    expect(shared).not.toContain('a1');
  });
});
