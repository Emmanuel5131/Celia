import { describe, expect, it } from 'vitest';
import { OperatorsValidation } from '@/validations/OperatorsValidation';

const row = {
  name: 'Company behind the site',
  role: 'runs',
  roleNote: null,
  jurisdiction: null,
  notes: null,
};

describe('Operators validation', () => {
  it('accepts any number of rows', () => {
    const rows = Array.from({ length: 40 }, () => row);

    expect(OperatorsValidation.safeParse(rows).success).toBeTruthy();
  });

  it('accepts none, which clears the list', () => {
    expect(OperatorsValidation.safeParse([]).success).toBeTruthy();
  });

  it('rejects a row without a name', () => {
    expect(OperatorsValidation.safeParse([{ ...row, name: '' }]).success).toBeFalsy();
  });

  it('rejects a role that is not listed', () => {
    expect(OperatorsValidation.safeParse([{ ...row, role: 'boss' }]).success).toBeFalsy();
  });

  it('accepts a row with no role', () => {
    expect(OperatorsValidation.safeParse([{ ...row, role: null }]).success).toBeTruthy();
  });

  it('rejects the role other without a description', () => {
    expect(OperatorsValidation.safeParse([{ ...row, role: 'other' }]).success).toBeFalsy();
  });

  it('accepts the role other with a description', () => {
    expect(
      OperatorsValidation.safeParse([{ ...row, role: 'other', roleNote: 'Runs the support desk' }])
        .success,
    ).toBeTruthy();
  });

  it('rejects an unknown jurisdiction', () => {
    expect(
      OperatorsValidation.safeParse([{ ...row, jurisdiction: 'nowhere' }]).success,
    ).toBeFalsy();
  });

  it('rejects notes that declare fraud', () => {
    expect(OperatorsValidation.safeParse([{ ...row, notes: 'Ran a scam' }]).success).toBeFalsy();
  });
});
