import { describe, expect, it } from 'vitest';
import { NewReportValidation, ReportValidation } from '@/validations/ReportValidation';
import { canonicalJson, describeCase, hashReport, parseDollars, readNewReport } from './Report';

const report = {
  version: 1,
  headline: 'The chain shows 142 wallets sending funds to one address. It does not show intent.',
  figures: [{ label: 'Wallets', value: '142' }],
  checks: [
    {
      claim: 'Withdrawals are always available.',
      evidence: 'No withdrawals appear after the 14th of September.',
      result: 'proven',
      tests: ['funding-trail'],
    },
  ],
  tests: [
    {
      id: 'funding-trail',
      title: 'Funding trail',
      summary: 'No transfer to a user wallet after 14 September.',
      columns: ['Day', 'Outgoing transfers'],
      rows: [
        ['13 Sep', '41'],
        ['14 Sep', '0'],
      ],
    },
  ],
  method: {},
  dataAsOf: '2026-10-27T10:00:00Z',
  sources: ['Solana RPC'],
};

describe(canonicalJson, () => {
  it('orders keys so the same findings give the same text', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it('keeps the order of a list', () => {
    expect(canonicalJson([2, 1])).toBe('[2,1]');
  });

  it('leaves out undefined values', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe(hashReport, () => {
  it('gives the same hash however the keys were ordered', () => {
    const reordered = Object.fromEntries(Object.entries(report).toReversed());

    expect(hashReport(reordered)).toBe(hashReport(report));
  });

  it('changes when a finding changes', () => {
    const changed = {
      ...report,
      checks: [{ ...report.checks[0], result: 'not_proven' }],
    };

    expect(hashReport(changed)).not.toBe(hashReport(report));
  });

  it('is 0x and 64 hex characters', () => {
    expect(hashReport(report)).toMatch(/^0x[\da-f]{64}$/u);
  });
});

describe('Report format', () => {
  it('accepts a report in the house language', () => {
    expect(ReportValidation.safeParse(report).success).toBeTruthy();
  });

  it('accepts a notebook link over https', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        method: { notebookUrl: 'https://example.com/notebook/abc' },
      }).success,
    ).toBeTruthy();
  });

  it('rejects a notebook link that is not https', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        method: { notebookUrl: 'http://example.com/notebook/abc' },
      }).success,
    ).toBeFalsy();
  });

  it('requires a table for every test in a new report', () => {
    const [test] = report.tests;
    const without = {
      ...report,
      tests: [{ id: 'funding-trail', title: 'Funding trail', summary: test?.summary }],
    };

    expect(NewReportValidation.safeParse(report).success).toBeTruthy();
    expect(NewReportValidation.safeParse(without).success).toBeFalsy();
    expect(ReportValidation.safeParse(without).success).toBeTruthy();
  });

  it('rejects a report with no checks', () => {
    expect(ReportValidation.safeParse({ ...report, checks: [] }).success).toBeFalsy();
  });

  it.each(['scams', 'scammed', 'scamming', 'guarantees', 'exposed', 'exposing'])(
    'rejects the form "%s" of a word Celia does not use',
    (word) => {
      expect(
        ReportValidation.safeParse({ ...report, headline: `The platform ${word} people.` }).success,
      ).toBeFalsy();
    },
  );

  it('rejects text that declares fraud', () => {
    expect(
      ReportValidation.safeParse({ ...report, headline: 'This platform is a scam.' }).success,
    ).toBeFalsy();
  });

  it('rejects text that promises an outcome', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        checks: [{ ...report.checks[0], evidence: 'Victims are guaranteed a payout.' }],
      }).success,
    ).toBeFalsy();
  });

  it('rejects a result that is not one of the four', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        checks: [{ ...report.checks[0], result: 'fraud' }],
      }).success,
    ).toBeFalsy();
  });

  it('rejects a commitment that is not a 32-byte hash', () => {
    expect(
      ReportValidation.safeParse({ ...report, method: { ...report.method, commitment: '0x12' } })
        .success,
    ).toBeFalsy();
  });

  it('rejects a check that points at a test the report does not have', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        checks: [{ ...report.checks[0], tests: ['no-such-test'] }],
      }).success,
    ).toBeFalsy();
  });

  it('rejects two tests with the same id', () => {
    expect(
      ReportValidation.safeParse({ ...report, tests: [report.tests[0], report.tests[0]] }).success,
    ).toBeFalsy();
  });

  it('rejects a table row that is not as wide as its headings', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        tests: [{ ...report.tests[0], rows: [['only one cell']] }],
      }).success,
    ).toBeFalsy();
  });

  it('accepts a test with a summary and no table', () => {
    expect(
      ReportValidation.safeParse({
        ...report,
        tests: [{ id: 'funding-trail', title: 'Funding trail', summary: 'A short finding.' }],
      }).success,
    ).toBeTruthy();
  });

  it('accepts a proof link outside Celia over https only', () => {
    const withLink = (url: string) => ({
      ...report,
      checks: [{ ...report.checks[0], proof: [{ label: 'Transaction', url }] }],
    });

    expect(
      ReportValidation.safeParse(withLink('https://explorer.example/tx/1')).success,
    ).toBeTruthy();
    expect(
      ReportValidation.safeParse(withLink('http://explorer.example/tx/1')).success,
    ).toBeFalsy();
  });
});

describe(describeCase, () => {
  const parsed = ReportValidation.parse(report);

  it('writes the estimate then each proven finding', () => {
    const described = describeCase({
      ...parsed,
      estimate: { wallets: '142', losses: '$310,000' },
    });

    expect(described).toBe(
      '142 wallets, estimated loss of $310,000 to this platform.\n\nThe platform said: Withdrawals are always available. No withdrawals appear after the 14th of September.',
    );
  });

  it('leaves out findings that are not proven', () => {
    const checks = parsed.checks.map((check) => ({ ...check, result: 'not_checkable' as const }));

    expect(describeCase({ ...parsed, checks })).toBeNull();
  });
});

describe(parseDollars, () => {
  it.each([
    ['$834,000', 834_000],
    ['$1.2M', 1_200_000],
    ['$12k', 12_000],
    ['US$ 5,000', 5000],
  ])('reads %s', (text, expected) => {
    expect(parseDollars(text)).toBe(expected);
  });

  it.each(['12 ETH', 'a lot', '', undefined])('does not guess at %s', (text) => {
    expect(parseDollars(text)).toBeNull();
  });
});

describe(readNewReport, () => {
  it('returns the report when it satisfies the format', () => {
    expect(readNewReport(report)).toStrictEqual({ report });
  });

  it('refuses words that declare fraud', () => {
    expect(readNewReport({ ...report, headline: 'This platform is a scam.' })).toStrictEqual({
      problem: 'words',
    });
  });

  it('refuses a test with no table', () => {
    const { columns: _columns, rows: _rows, ...bare } = report.tests[0] ?? {};

    expect(readNewReport({ ...report, tests: [bare] })).toStrictEqual({ problem: 'table' });
  });

  it('refuses an estimate with no readable dollar amount', () => {
    expect(
      readNewReport({ ...report, estimate: { wallets: '142', losses: '12,000 SOL' } }),
    ).toStrictEqual({ problem: 'loss' });
  });

  it('refuses anything that is not a report', () => {
    expect(readNewReport({ headline: 'Hello' })).toStrictEqual({ problem: 'schema' });
  });
});
