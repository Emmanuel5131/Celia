import { getJurisdiction } from '@celia/jurisdictions';
import * as z from 'zod';
import { forbiddenWords } from '@/validations/ReportValidation';

const words = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' });

/**
 * An alleged action as staff enter it. The house language applies from the start: it records what is alleged to have been done and
 * never declares fraud. A jurisdiction, when given, must be a known one.
 */
export const ActionValidation = z.object({
  kind: words(80).optional(),
  title: words(200),
  note: words(1000).optional(),
  occurredOn: z.iso.date().optional(),
  jurisdiction: z
    .string()
    .refine((id) => getJurisdiction(id) !== undefined)
    .optional(),
});
