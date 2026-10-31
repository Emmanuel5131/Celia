import { describe, expect, it } from 'vitest';
import {
  MessageValidation,
  RulesValidation,
  WhoValidation,
} from '@/validations/ContactRequestValidation';
import { mayBeAsked, contactDeclarations } from './ContactRequest';

const claim = {
  validatedAt: new Date(),
  rejectedAt: null,
  contactAgreedAt: new Date(),
};

describe(mayBeAsked, () => {
  it('asks a confirmed claim whose owner agreed', () => {
    expect(mayBeAsked(claim)).toBeTruthy();
  });

  it('skips a claim whose owner did not agree', () => {
    expect(mayBeAsked({ ...claim, contactAgreedAt: null })).toBeFalsy();
  });

  it('skips a claim staff have not confirmed', () => {
    expect(mayBeAsked({ ...claim, validatedAt: null })).toBeFalsy();
  });

  it('skips a rejected claim', () => {
    expect(mayBeAsked({ ...claim, rejectedAt: new Date() })).toBeFalsy();
  });
});

describe('rules validation', () => {
  it('needs every rule ticked', () => {
    expect(
      RulesValidation.safeParse({ declarations: contactDeclarations.slice(1) }).success,
    ).toBeFalsy();
  });

  it('accepts all rules ticked', () => {
    expect(
      RulesValidation.safeParse({ declarations: [...contactDeclarations] }).success,
    ).toBeTruthy();
  });
});

describe('message validation', () => {
  const base =
    'We are a victim support group and would like to hear what happened to you, if you are willing to talk.';

  it('accepts a plain message', () => {
    expect(MessageValidation.safeParse({ message: base }).success).toBeTruthy();
  });

  it('refuses a promise of recovery', () => {
    expect(
      MessageValidation.safeParse({ message: `${base} We will get your money back for you.` })
        .success,
    ).toBeFalsy();
  });

  it('refuses a declaration of fraud', () => {
    expect(
      MessageValidation.safeParse({ message: `${base} The platform is a scam and a fraud.` })
        .success,
    ).toBeFalsy();
  });
});

describe('who validation', () => {
  it('needs a description when the purpose is other', () => {
    expect(WhoValidation.safeParse({ purpose: 'other', askerRole: 'Partner' }).success).toBeFalsy();
  });

  it('accepts the organisation own words for other', () => {
    expect(
      WhoValidation.safeParse({
        purpose: 'other',
        purposeOther: 'To share a regulator notice',
        askerRole: 'Partner',
      }).success,
    ).toBeTruthy();
  });

  it('accepts a listed purpose without a description', () => {
    expect(
      WhoValidation.safeParse({ purpose: 'representation', askerRole: 'Partner' }).success,
    ).toBeTruthy();
  });
});
