import type { Brief } from '@celia/core';
import { describe, expect, it } from 'vitest';
import { commitmentHash } from './Commitment';

const brief: Brief = {
  case: { id: 'case-1', number: 'CB-0142', name: 'Example platform' },
  template: { id: 'investment-platform', version: '1.0.0' },
  chains: ['ethereum'],
  receivingAddresses: [
    { chain: 'ethereum', address: '0x52908400098527886E0F7030069857D2E4169EE7' },
  ],
  tokenContracts: [],
  hosts: ['example.com'],
  window: { from: '2026-09-01', to: '2026-10-31' },
  platformStatements: [],
  tests: [],
  budget: { maxRuns: 3, maxPagesPerAddress: 50, timeoutSeconds: 300 },
  skippedChains: [],
};

describe(commitmentHash, () => {
  it('gives 0x and 64 hex characters', () => {
    expect(commitmentHash(brief)).toMatch(/^0x[\da-f]{64}$/u);
  });

  it('gives the same hash for the same brief', () => {
    expect(commitmentHash(brief)).toBe(commitmentHash({ ...brief }));
  });

  it('ignores the order the keys were written in', () => {
    const reordered: Brief = {
      skippedChains: brief.skippedChains,
      budget: brief.budget,
      tests: brief.tests,
      platformStatements: brief.platformStatements,
      window: brief.window,
      hosts: brief.hosts,
      tokenContracts: brief.tokenContracts,
      receivingAddresses: brief.receivingAddresses,
      chains: brief.chains,
      template: brief.template,
      case: brief.case,
    };

    expect(commitmentHash(reordered)).toBe(commitmentHash(brief));
  });

  it('changes when the window changes', () => {
    expect(commitmentHash({ ...brief, window: { from: '2026-09-02', to: '2026-10-31' } })).not.toBe(
      commitmentHash(brief),
    );
  });

  it('changes when the template version changes', () => {
    expect(
      commitmentHash({ ...brief, template: { id: 'investment-platform', version: '1.0.1' } }),
    ).not.toBe(commitmentHash(brief));
  });
});
