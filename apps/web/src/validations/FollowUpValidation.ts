import * as z from 'zod';
import { followUpChannels } from '@/utils/claims/FollowUp';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/**
 * How a person wants to be followed up about their claim: the way, the number or handle for a way other than email, and a good
 * time and language in their own words. Email needs nothing more, because it uses the address on their account.
 */
export const FollowUpValidation = z
  .object({
    channel: z.enum(followUpChannels),
    value: optionalText(120),
    bestTime: optionalText(120),
  })
  .refine((input) => input.channel === 'email' || (input.value?.length ?? 0) >= 3, {
    message: 'value_missing',
    path: ['value'],
  })
  .transform((input) => ({ ...input, value: input.channel === 'email' ? undefined : input.value }));

export type FollowUpInput = z.infer<typeof FollowUpValidation>;
