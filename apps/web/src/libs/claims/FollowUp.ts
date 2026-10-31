import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { claimFollowUpSchema } from '@/models/Schema';
import type { FollowUpInput } from '@/validations/FollowUpValidation';

/**
 * Reads how a person wants to be followed up on a claim.
 * @param claimId - The claim id.
 * @returns The way, the number or handle and the good time, or undefined when none was given.
 */
export async function readFollowUp(claimId: string) {
  const [row] = await db
    .select({
      channel: claimFollowUpSchema.channel,
      value: claimFollowUpSchema.value,
      bestTime: claimFollowUpSchema.bestTime,
    })
    .from(claimFollowUpSchema)
    .where(eq(claimFollowUpSchema.claimId, claimId));

  return row;
}

/**
 * Saves how a person wants to be followed up on a claim, replacing what was there.
 * @param claimId - The claim id.
 * @param input - The checked details.
 */
export async function saveFollowUp(claimId: string, input: FollowUpInput) {
  const values = {
    channel: input.channel,
    value: input.value ?? null,
    bestTime: input.bestTime ?? null,
  };

  await db
    .insert(claimFollowUpSchema)
    .values({ claimId, ...values })
    .onConflictDoUpdate({ target: claimFollowUpSchema.claimId, set: values });
}

/**
 * Deletes what a person gave for follow-up on a claim.
 * @param claimId - The claim id.
 */
export async function removeFollowUp(claimId: string) {
  await db.delete(claimFollowUpSchema).where(eq(claimFollowUpSchema.claimId, claimId));
}
