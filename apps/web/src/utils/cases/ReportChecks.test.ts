import { describe, expect, it } from 'vitest';
import { checkRows } from './ReportChecks';

const report = {
  checks: [
    {
      claim: 'Withdrawals are always available.',
      evidence: 'Outgoing transfers to users fall to zero.',
      result: 'proven' as const,
      tests: ['withdrawals'],
    },
    {
      claim: 'Funds are held in a separate reserve.',
      evidence: 'The chain data read does not settle this.',
      result: 'not_checkable' as const,
    },
  ],
  tests: [
    {
      id: 'withdrawals',
      title: 'Withdrawals by week',
      summary: 'Outgoing transfers fall to zero.',
    },
  ],
};

describe(checkRows, () => {
  it('lists each check with the tests behind it', () => {
    const [first] = checkRows(report, (id) => `#test-${id}`);

    expect(first?.tests).toStrictEqual([
      { id: 'withdrawals', title: 'Withdrawals by week', href: '#test-withdrawals' },
    ]);
  });

  it('leaves a check with no tests with no links', () => {
    expect(checkRows(report, (id) => id)[1]?.tests).toStrictEqual([]);
  });

  it('carries the proof links of a check', () => {
    const proof = [{ label: 'Transaction', url: 'https://example.com/tx' }];
    const [check] = report.checks;
    const [first] = checkRows(
      { ...report, checks: check ? [{ ...check, proof }] : [] },
      (id) => id,
    );

    expect(first?.proof).toStrictEqual(proof);
  });

  it('keeps the order of the report', () => {
    expect(checkRows(report, (id) => id).map((row) => row.result)).toStrictEqual([
      'proven',
      'not_checkable',
    ]);
  });
});
