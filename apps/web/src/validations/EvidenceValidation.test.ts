import { describe, expect, it } from 'vitest';
import { EvidenceValidation } from '@/validations/EvidenceValidation';

const base = { title: 'Promo video', lawful: true } as const;

describe('Evidence input', () => {
  describe('files', () => {
    it('accepts a video with a title', () => {
      expect(EvidenceValidation.safeParse({ ...base, type: 'video' }).success).toBeTruthy();
    });

    it('refuses evidence without the lawful confirmation', () => {
      expect(
        EvidenceValidation.safeParse({ type: 'video', title: 'Promo video', lawful: false })
          .success,
      ).toBeFalsy();
    });

    it('refuses a title with a wording the report refuses', () => {
      expect(
        EvidenceValidation.safeParse({ ...base, type: 'video', title: 'A scam promo' }).success,
      ).toBeFalsy();
    });
  });

  describe('links', () => {
    it('requires where the page is', () => {
      expect(EvidenceValidation.safeParse({ ...base, type: 'link' }).success).toBeFalsy();
    });

    it('refuses a link that is not https', () => {
      expect(
        EvidenceValidation.safeParse({ ...base, type: 'link', sourceUrl: 'http://example.com' })
          .success,
      ).toBeFalsy();
    });

    it('accepts an https link', () => {
      expect(
        EvidenceValidation.safeParse({ ...base, type: 'link', sourceUrl: 'https://example.com/a' })
          .success,
      ).toBeTruthy();
    });
  });

  describe('on-chain evidence', () => {
    it('requires a chain and a reference', () => {
      expect(EvidenceValidation.safeParse({ ...base, type: 'wallet' }).success).toBeFalsy();
    });

    it('refuses a malformed address', () => {
      expect(
        EvidenceValidation.safeParse({
          ...base,
          type: 'wallet',
          chain: 'ethereum',
          reference: '0x123',
        }).success,
      ).toBeFalsy();
    });

    it('accepts a well-formed address', () => {
      expect(
        EvidenceValidation.safeParse({
          ...base,
          type: 'wallet',
          chain: 'ethereum',
          reference: '0x52908400098527886E0F7030069857D2E4169EE7',
        }).success,
      ).toBeTruthy();
    });
  });
});
