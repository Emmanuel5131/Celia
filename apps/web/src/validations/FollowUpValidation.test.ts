import { describe, expect, it } from 'vitest';
import { FollowUpValidation } from '@/validations/FollowUpValidation';

describe('follow-up validation', () => {
  it('accepts email with nothing else', () => {
    expect(FollowUpValidation.safeParse({ channel: 'email' }).success).toBeTruthy();
  });

  it('needs a number or handle for phone', () => {
    expect(FollowUpValidation.safeParse({ channel: 'phone', value: '' }).success).toBeFalsy();
  });

  it('accepts a phone number with a good time', () => {
    expect(
      FollowUpValidation.safeParse({
        channel: 'phone',
        value: '+234 801 234 5678',
        bestTime: 'Evenings, in English',
      }).success,
    ).toBeTruthy();
  });

  it('drops a number typed before switching to email', () => {
    const parsed = FollowUpValidation.parse({ channel: 'email', value: '+234 801 234 5678' });

    expect(parsed.value).toBeUndefined();
  });

  it('refuses a way outside the list', () => {
    expect(FollowUpValidation.safeParse({ channel: 'carrier-pigeon' }).success).toBeFalsy();
  });

  it('refuses a good time that is too long', () => {
    expect(
      FollowUpValidation.safeParse({ channel: 'email', bestTime: 'x'.repeat(121) }).success,
    ).toBeFalsy();
  });
});
