import { describe, expect, it } from 'vitest';
import { FindingsValidation } from './FindingsValidation';

const test = {
  id: 'withdrawals-by-day',
  title: 'Withdrawals by day',
  summary: 'Outgoing transfers fall to 0 on 14 Sep and stay there.',
  verdict: 'proven',
  columns: ['Day', 'Outgoing to users'],
  rows: [
    ['13 Sep', '19'],
    ['14 Sep', '0'],
  ],
  charts: [
    {
      type: 'bar',
      x: ['13 Sep', '14 Sep'],
      series: [{ name: 'Outgoing to users', values: [19, 0] }],
      threshold: { value: 1, label: 'Fixed threshold' },
    },
  ],
  notes: ['Counts every successful payment into the contract.'],
};

const findings = {
  celia: 1,
  run: {
    templateId: 'investment-platform',
    templateVersion: '1.0.0',
    notebookUrl: 'https://app.sandwormlab.xyz/notebook/abc',
    attestation: { codeHash: '0xabc' },
    dataAsOf: '2026-10-31T10:00:00Z',
  },
  tests: [test],
};

const withTest = (change: Record<string, unknown>) => ({
  ...findings,
  tests: [{ ...test, ...change }],
});

describe('findings file', () => {
  it('accepts findings the notebook wrote', () => {
    expect(FindingsValidation.safeParse(findings).success).toBeTruthy();
  });

  it('accepts a test without a chart', () => {
    expect(
      FindingsValidation.safeParse(withTest({ charts: undefined, notes: undefined })).success,
    ).toBeTruthy();
  });

  it('refuses a verdict that is not one of the four', () => {
    expect(FindingsValidation.safeParse(withTest({ verdict: 'fraud' })).success).toBeFalsy();
  });

  it('refuses a summary with a word Celia does not use', () => {
    expect(
      FindingsValidation.safeParse(withTest({ summary: 'This is a scam.' })).success,
    ).toBeFalsy();
  });

  it('refuses a test without a table', () => {
    expect(FindingsValidation.safeParse(withTest({ rows: undefined })).success).toBeFalsy();
  });

  it('refuses a row as wide as another number of columns', () => {
    expect(FindingsValidation.safeParse(withTest({ rows: [['13 Sep']] })).success).toBeFalsy();
  });

  it('refuses more than 50 rows', () => {
    const rows = Array.from({ length: 51 }, (_, index) => [String(index), '1']);

    expect(FindingsValidation.safeParse(withTest({ rows })).success).toBeFalsy();
  });

  it('refuses a chart whose series is as long as another number of points', () => {
    const chart = { ...test.charts[0], series: [{ name: 'Outgoing to users', values: [19] }] };

    expect(FindingsValidation.safeParse(withTest({ charts: [chart] })).success).toBeFalsy();
  });

  it('refuses two tests with the same id', () => {
    expect(FindingsValidation.safeParse({ ...findings, tests: [test, test] }).success).toBeFalsy();
  });

  it('refuses a notebook link that is not https', () => {
    expect(
      FindingsValidation.safeParse({
        ...findings,
        run: { ...findings.run, notebookUrl: 'http://example.com' },
      }).success,
    ).toBeFalsy();
  });

  it('refuses a file that is not a Celia findings file', () => {
    expect(FindingsValidation.safeParse({ ...findings, celia: 2 }).success).toBeFalsy();
  });
});
