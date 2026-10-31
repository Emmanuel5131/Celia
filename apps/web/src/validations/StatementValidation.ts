import { statementKinds } from '@celia/core';
import * as z from 'zod';
import { forbiddenWords } from '@/validations/ReportValidation';

/**
 * A public statement a platform made, as staff enter it. The house language applies from the start, so a wording the report would
 * refuse is caught here and not when the report is saved: write what the platform said without the words Celia does not use.
 */
export const StatementValidation = z.object({
  kind: z.enum(statementKinds),
  text: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' }),
  /** Where the platform said it, so anyone can check. https only. */
  sourceUrl: z.url({ protocol: /^https$/u }).max(300),
  saidOn: z.iso.date().optional(),
});

/** The most statements a case holds: enough to test what the platform leaned on, few enough to stay a brief. */
export const maxStatements = 5;
