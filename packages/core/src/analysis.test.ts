import { describe, expect, it } from 'vitest';
import { dominantFraudType, prepareAnalysis, templateFor } from './analysis';
import type { BriefInput } from './analysis';

const evm = '0x52908400098527886E0F7030069857D2E4169EE7';
const other = '0x8617E340B3D01FA5F11F306F4090FD50E238070D';

const ready: BriefInput = {
  caseId: 'case-1',
  caseNumber: 'CB-0142',
  caseName: 'Example platform',
  status: 'building',
  confirmedClaims: 5,
  fraudTypes: ['investment_platform', 'investment_platform', 'impersonation'],
  receiving: [{ chain: 'ethereum', address: evm }],
  tokenContracts: [],
  hosts: ['Example.com'],
  firstPaymentAt: '2026-09-01T10:00:00Z',
  lastPaymentAt: null,
  statements: [
    {
      kind: 'withdrawals',
      text: 'Withdrawals are always available.',
      sourceUrl: 'https://example.com/faq',
    },
  ],
  runs: 0,
  now: new Date('2026-10-31T12:00:00Z'),
};

const codes = (input: BriefInput) => prepareAnalysis(input).problems.map((problem) => problem.code);

describe(prepareAnalysis, () => {
  it('builds a brief for a case that is ready', () => {
    const { brief, problems } = prepareAnalysis(ready);

    expect(problems).toStrictEqual([]);
    expect(brief).toMatchObject({
      template: { id: 'investment-platform', version: '1.0.0' },
      chains: ['ethereum'],
      hosts: ['example.com'],
      window: { from: '2026-09-01', to: '2026-10-31' },
    });
  });

  it('says which tests back each statement', () => {
    const { brief } = prepareAnalysis(ready);

    expect(brief?.tests.find((test) => test.id === 'withdrawals-by-day')?.statements).toStrictEqual(
      [0],
    );
    expect(brief?.tests.find((test) => test.id === 'payout-source')?.statements).toStrictEqual([]);
  });

  it('blocks a sealed case', () => {
    expect(codes({ ...ready, status: 'sealed' })).toContain('sealed');
  });

  it('blocks a case without enough confirmed claims', () => {
    expect(codes({ ...ready, confirmedClaims: 4 })).toContain('not_enough_claims');
  });

  it('blocks a fraud type with no template', () => {
    expect(codes({ ...ready, fraudTypes: ['rug_pull'] })).toContain('no_template');
  });

  it('blocks a case with no platform statement', () => {
    expect(codes({ ...ready, statements: [] })).toContain('no_statement');
  });

  it('looks back as far as the template reads when no payment has a time, and says so', () => {
    const { brief, problems } = prepareAnalysis({ ...ready, firstPaymentAt: null });

    expect(brief?.window).toStrictEqual({ from: '2024-10-31', to: '2026-10-31' });
    expect(problems).toStrictEqual([{ code: 'window_estimated', blocking: false }]);
  });

  it('treats a payment time that cannot be read as unknown', () => {
    expect(codes({ ...ready, firstPaymentAt: 'not a date' })).toStrictEqual(['window_estimated']);
  });

  it('blocks a case with no address', () => {
    expect(codes({ ...ready, receiving: [] })).toContain('no_identifier');
  });

  it('blocks a case whose addresses are all on chains notebooks cannot read', () => {
    const problems = codes({
      ...ready,
      receiving: [{ chain: 'tron', address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' }],
    });

    expect(problems).toContain('no_analysable_chain');
    expect(problems).toContain('chains_skipped');
  });

  it('blocks once the case has used its runs', () => {
    expect(codes({ ...ready, runs: 3 })).toContain('run_cap');
  });

  it('gives no brief while anything blocks', () => {
    expect(prepareAnalysis({ ...ready, statements: [] }).brief).toBeNull();
  });

  it('skips an address with the wrong shape and says so', () => {
    const result = prepareAnalysis({
      ...ready,
      receiving: [
        { chain: 'ethereum', address: evm },
        { chain: 'ethereum', address: '0x123' },
      ],
    });

    expect(result.brief?.receivingAddresses).toHaveLength(1);
    expect(result.problems).toStrictEqual([{ code: 'addresses_skipped', blocking: false }]);
  });

  it('lists an address once whatever its capitals', () => {
    const { brief } = prepareAnalysis({
      ...ready,
      receiving: [
        { chain: 'ethereum', address: evm },
        { chain: 'ethereum', address: evm.toLowerCase() },
        { chain: 'base', address: evm },
        { chain: 'ethereum', address: other },
      ],
    });

    expect(brief?.receivingAddresses).toHaveLength(3);
  });

  it('keeps the chains it cannot read as statement only', () => {
    const { brief, problems } = prepareAnalysis({
      ...ready,
      receiving: [
        { chain: 'ethereum', address: evm },
        { chain: 'tron', address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' },
      ],
    });

    expect(brief?.skippedChains).toStrictEqual(['tron']);
    expect(problems).toStrictEqual([{ code: 'chains_skipped', blocking: false }]);
  });

  it('warns about a statement no test can answer', () => {
    const result = prepareAnalysis({
      ...ready,
      statements: [
        ...ready.statements,
        { kind: 'other', text: 'We are regulated.', sourceUrl: 'https://example.com/about' },
      ],
    });

    expect(result.brief).not.toBeNull();
    expect(result.problems).toStrictEqual([{ code: 'statement_not_checkable', blocking: false }]);
  });

  it('ends the window a month after the last known payment', () => {
    const { brief } = prepareAnalysis({
      ...ready,
      firstPaymentAt: '2020-01-20T00:00:00Z',
      lastPaymentAt: '2020-01-21',
    });

    expect(brief?.window).toStrictEqual({ from: '2020-01-20', to: '2020-02-20' });
  });

  it('never ends the window in the future', () => {
    const { brief } = prepareAnalysis({ ...ready, lastPaymentAt: '2026-10-25' });

    expect(brief?.window.to).toBe('2026-10-31');
  });

  it('runs to today when no payment date is known', () => {
    expect(prepareAnalysis(ready).brief?.window.to).toBe('2026-10-31');
  });

  it('clamps a window longer than the template allows, and says so', () => {
    const { brief, problems } = prepareAnalysis({
      ...ready,
      firstPaymentAt: '2020-01-01T00:00:00Z',
    });

    expect(brief?.window.from).toBe('2024-10-31');
    expect(problems).toStrictEqual([{ code: 'window_clamped', blocking: false }]);
  });
});

describe(dominantFraudType, () => {
  it('picks the most common type', () => {
    expect(dominantFraudType(['impersonation', 'rug_pull', 'rug_pull'])).toBe('rug_pull');
  });

  it('breaks a tie with the type lost most often', () => {
    expect(dominantFraudType(['rug_pull', 'investment_platform'])).toBe('investment_platform');
  });

  it('gives nothing for no claims', () => {
    expect(dominantFraudType([])).toBeUndefined();
  });
});

describe(templateFor, () => {
  it('finds the template for an investment platform', () => {
    expect(templateFor('investment_platform')).toBe('investment-platform');
  });

  it('finds none for a fraud type without one', () => {
    expect(templateFor('rug_pull')).toBeUndefined();
    expect(templateFor(undefined)).toBeUndefined();
  });
});
