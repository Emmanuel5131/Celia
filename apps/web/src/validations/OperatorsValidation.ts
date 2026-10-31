import { getJurisdiction } from '@celia/jurisdictions';
import * as z from 'zod';
import { operatorRoles } from '@/utils/cases/Operators';
import { forbiddenWords } from '@/validations/ReportValidation';

const words = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' });

/**
 * The people and groups staff list as behind a platform, as entered. The house language applies: the text records what is alleged
 * and never declares fraud. A name is required; a jurisdiction, when given, must be a known one.
 */
export const OperatorsValidation = z.array(
  z
    .object({
      name: words(120).min(1),
      role: z.enum(operatorRoles).nullable(),
      // What "other" means, in staff's own words; required with that role.
      roleNote: words(80).nullable(),
      jurisdiction: z
        .string()
        .refine((id) => getJurisdiction(id) !== undefined)
        .nullable(),
      notes: words(1000).nullable(),
    })
    .refine((row) => row.role !== 'other' || row.roleNote !== null, {
      path: ['roleNote'],
      message: 'required',
    }),
);
