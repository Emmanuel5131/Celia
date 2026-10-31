import { describe, expect, it } from 'vitest';
import { judgeEvidence, needsLookup, splitByEvidence } from './ClaimEvidence';
import type { EvidenceChecks } from './ClaimEvidence';

const claim = (overrides: Partial<Parameters<typeof judgeEvidence>[0]> = {}) => ({
  id: 'claim',
  signed: false,
  state: 'sent' as const,
  proof: null,
  ...overrides,
});
const video = { videoUrl: 'https://www.loom.com/share/x', files: [] };
const checks = (overrides: Partial<EvidenceChecks> = {}): EvidenceChecks => ({
  address: 'valid',
  video: 'none',
  wallet: 'empty',
  ...overrides,
});

describe(judgeEvidence, () => {
  it('keeps a signed wallet', () => {
    expect(judgeEvidence(claim({ signed: true }), checks())).toBe('keep');
  });

  it('keeps a file', () => {
    expect(judgeEvidence(claim({ proof: { videoUrl: null, files: [{}] } }), checks())).toBe('keep');
  });

  it('keeps a video that opens', () => {
    expect(judgeEvidence(claim({ proof: video }), checks({ video: 'ok' }))).toBe('keep');
  });

  it('keeps a wallet with activity', () => {
    expect(judgeEvidence(claim(), checks({ wallet: 'active' }))).toBe('keep');
  });

  it('keeps a claim when a lookup could not be made', () => {
    expect(judgeEvidence(claim(), checks({ wallet: 'unknown' }))).toBe('keep');
    expect(judgeEvidence(claim({ proof: video }), checks({ video: 'unknown' }))).toBe('keep');
  });

  it('turns down a claim with nothing added and an empty wallet', () => {
    expect(judgeEvidence(claim(), checks())).toBe('nothing');
    expect(judgeEvidence(claim(), checks({ wallet: 'none' }))).toBe('nothing');
  });

  it('turns down an invalid address whatever else the claim has', () => {
    expect(judgeEvidence(claim({ signed: true }), checks({ address: 'invalid' }))).toBe(
      'invalidAddress',
    );
  });

  it('turns down a video link that is gone or not a link whatever else the claim has', () => {
    const signed = claim({ signed: true, proof: video });

    expect(judgeEvidence(signed, checks({ video: 'gone' }))).toBe('badLink');
    expect(judgeEvidence(signed, checks({ video: 'invalid' }))).toBe('badLink');
  });

  it('keeps a claim staff already started reviewing', () => {
    expect(judgeEvidence(claim({ state: 'in_review' }), checks({ address: 'invalid' }))).toBe(
      'keep',
    );
  });
});

describe(needsLookup, () => {
  it('asks about the wallet only for sent claims with no signature or file', () => {
    expect(needsLookup(claim())).toBeTruthy();
    expect(needsLookup(claim({ signed: true }))).toBeFalsy();
    expect(needsLookup(claim({ state: 'in_review' }))).toBeFalsy();
  });
});

describe(splitByEvidence, () => {
  it('groups the claims by what happens to them', () => {
    const result = splitByEvidence(
      [claim({ id: 'a' }), claim({ id: 'b' }), claim({ id: 'c' }), claim({ id: 'd' })],
      new Map([
        ['a', checks()],
        ['b', checks({ address: 'invalid' })],
        ['c', checks({ video: 'gone' })],
        ['d', checks({ wallet: 'active' })],
      ]),
    );

    expect(result).toStrictEqual({
      invalidAddress: ['b'],
      badLink: ['c'],
      nothing: ['a'],
      keep: ['d'],
    });
  });
});
