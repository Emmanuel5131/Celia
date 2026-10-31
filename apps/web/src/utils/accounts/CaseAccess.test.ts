import { describe, expect, it } from 'vitest';
import { caseAccess } from './CaseAccess';

describe(caseAccess, () => {
  it('gives staff the full case', () => {
    expect(caseAccess({ account: null, staff: true })).toBe('full');
  });

  it('gives a verified organisation the full case', () => {
    expect(
      caseAccess({ account: { accountType: 'counsel', review: 'verified' }, staff: false }),
    ).toBe('full');
  });

  it('limits an organisation that is not verified', () => {
    expect(
      caseAccess({ account: { accountType: 'counsel', review: 'pending' }, staff: false }),
    ).toBe('unverified');
  });

  it('limits a counsel account with no review status', () => {
    expect(caseAccess({ account: { accountType: 'counsel' }, staff: false })).toBe('unverified');
  });

  it('limits a regular account', () => {
    expect(caseAccess({ account: { accountType: 'person' }, staff: false })).toBe('person');
  });

  it('limits someone with no account', () => {
    expect(caseAccess({ account: null, staff: false })).toBe('person');
  });
});
