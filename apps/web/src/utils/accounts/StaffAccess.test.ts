import { describe, expect, it } from 'vitest';
import { parseStaffEmails, staffAccess } from '@/utils/accounts/StaffAccess';

const base = {
  staff: true,
  email: 'ana@celia.example',
  twoFactor: true,
  allowed: ['ana@celia.example'],
  domain: null,
  production: true,
  twoFactorRequired: true,
};

describe(parseStaffEmails, () => {
  it('splits, trims and lowers the addresses', () => {
    expect(parseStaffEmails(' Ana@Celia.example , bo@celia.example,')).toStrictEqual([
      'ana@celia.example',
      'bo@celia.example',
    ]);
  });

  it('gives nothing for no setting', () => {
    expect(parseStaffEmails()).toStrictEqual([]);
  });
});

describe(staffAccess, () => {
  it('lets in listed staff with two-step sign-in', () => {
    expect(staffAccess(base)).toBe('allowed');
  });

  it('turns away an account that is not staff', () => {
    expect(staffAccess({ ...base, staff: false })).toBe('not_staff');
  });

  it('turns away staff whose email is not on the list', () => {
    expect(staffAccess({ ...base, email: 'eve@celia.example' })).toBe('email_not_allowed');
  });

  it('turns away staff with no verified email', () => {
    expect(staffAccess({ ...base, email: null })).toBe('email_not_allowed');
  });

  it('lets in anyone on the Celia domain', () => {
    expect(
      staffAccess({ ...base, email: 'bo@celia.example', allowed: [], domain: 'celia.example' }),
    ).toBe('allowed');
  });

  it('does not let in a lookalike domain', () => {
    expect(
      staffAccess({
        ...base,
        email: 'bo@evil-celia.example',
        allowed: [],
        domain: 'celia.example',
      }),
    ).toBe('email_not_allowed');
  });

  it('lets nobody in when the list and no domain in production', () => {
    expect(staffAccess({ ...base, allowed: [] })).toBe('email_not_allowed');
  });

  it('lets listed staff in without two-step sign-in when the settings turn it off', () => {
    expect(staffAccess({ ...base, twoFactor: false, twoFactorRequired: false })).toBe('allowed');
  });

  it('still checks the email when two-step sign-in is off', () => {
    expect(
      staffAccess({
        ...base,
        email: 'eve@celia.example',
        twoFactor: false,
        twoFactorRequired: false,
      }),
    ).toBe('email_not_allowed');
  });

  it('asks for two-step sign-in in production', () => {
    expect(staffAccess({ ...base, twoFactor: false })).toBe('needs_two_factor');
  });

  it('matches the email without regard to case', () => {
    expect(staffAccess({ ...base, email: 'ANA@celia.example' })).toBe('allowed');
  });

  it('lets staff in during development with no list and no two-step sign-in', () => {
    expect(staffAccess({ ...base, allowed: [], twoFactor: false, production: false })).toBe(
      'allowed',
    );
  });

  it('holds development to the list once it is set', () => {
    expect(staffAccess({ ...base, email: 'eve@celia.example', production: false })).toBe(
      'email_not_allowed',
    );
  });
});
