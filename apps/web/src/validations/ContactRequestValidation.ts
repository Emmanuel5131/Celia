import * as z from 'zod';
import {
  advertWords,
  contactDeclarations,
  contactPurposes,
  promiseWords,
} from '@/utils/contact/ContactRequest';
import { forbiddenWords } from '@/validations/ReportValidation';

const plain = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' });

/** Step 1: who is asking and why in one word. The organisation itself comes from its approved application. */
export const WhoValidation = z
  .object({
    purpose: z.enum(contactPurposes),
    /** The organisation's own words, needed when the purpose is `other`. */
    purposeOther: plain(3, 120).optional(),
    askerRole: plain(2, 80),
  })
  .refine((who) => who.purpose !== 'other' || who.purposeOther !== undefined, {
    message: 'purpose_other_missing',
    path: ['purposeOther'],
  });

/** Step 2: what the organisation wants from the claimants. */
export const WhyValidation = z.object({
  reason: plain(40, 1000),
});

/** Step 3: every rule ticked. A missing tick fails the step. */
export const RulesValidation = z.object({
  declarations: z
    .array(z.enum(contactDeclarations))
    .refine((ticked) => contactDeclarations.every((rule) => ticked.includes(rule)), {
      message: 'rules_missing',
    }),
});

/** Step 4: the words the claimants will read, written in markdown by the rich text editor. No promise of an outcome, a recovery or a fee, and no advertising. */
export const MessageValidation = z.object({
  message: plain(60, 2000)
    .refine((value) => !promiseWords.test(value), { message: 'promise_words' })
    .refine((value) => !advertWords.test(value), { message: 'advert_words' }),
});
