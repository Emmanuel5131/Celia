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
};

describe(checkRows, () => {
  it('lists each check with its claim, result and evidence', () => {
    expect(checkRows(report)[0]).toMatchObject({
      claim: 'Withdrawals are always available.',
      result: 'proven',
      evidence: 'Outgoing transfers to users fall to zero.',
    });
  });

  it('carries the proof links of a check', () => {
    const proof = [{ label: 'Transaction', url: 'https://example.com/tx' }];
    const [check] = report.checks;
    const [first] = checkRows({ checks: check ? [{ ...check, proof }] : [] });

    expect(first?.proof).toStrictEqual(proof);
  });

  it('keeps the order of the report', () => {
    expect(checkRows(report).map((row) => row.result)).toStrictEqual(['proven', 'not_checkable']);
  });
});
