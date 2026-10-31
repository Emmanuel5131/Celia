import { describe, expect, it } from 'vitest';
import { ActionValidation } from '@/validations/ActionValidation';

const action = { kind: 'Withdrawals', title: 'Stopped withdrawals after deposits' };

describe('Action validation', () => {
  it('accepts an action with only a title', () => {
    expect(ActionValidation.safeParse({ title: action.title }).success).toBeTruthy();
  });

  it('accepts an action with a kind in plain words', () => {
    expect(ActionValidation.safeParse(action).success).toBeTruthy();
  });

  it('rejects an action without a title', () => {
    expect(ActionValidation.safeParse({ ...action, title: '' }).success).toBeFalsy();
  });

  it('rejects a kind that declares fraud', () => {
    expect(ActionValidation.safeParse({ ...action, kind: 'A scam' }).success).toBeFalsy();
  });

  it('rejects an unknown jurisdiction', () => {
    expect(ActionValidation.safeParse({ ...action, jurisdiction: 'nowhere' }).success).toBeFalsy();
  });

  it('rejects text that declares fraud', () => {
    expect(ActionValidation.safeParse({ ...action, title: 'A scam' }).success).toBeFalsy();
  });
});
