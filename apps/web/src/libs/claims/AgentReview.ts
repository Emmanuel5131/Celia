import { and, eq, inArray, isNull } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { claimAgentReviewSchema, claimSchema } from '@/models/Schema';

/** The assistant's review of one claim. */
export type ClaimAgentReview = { interesting: boolean; message: string; reviewedAt: string };

/**
 * Reads the assistant's reviews of some claims.
 * @param claimIds - The claims.
 * @returns The review of each claim that has one, by claim id.
 */
export async function listAgentReviews(claimIds: string[]) {
  const reviews = new Map<string, ClaimAgentReview>();

  if (claimIds.length === 0) {
    return reviews;
  }

  const rows = await db
    .select()
    .from(claimAgentReviewSchema)
    .where(inArray(claimAgentReviewSchema.claimId, claimIds));

  for (const row of rows) {
    reviews.set(row.claimId, {
      interesting: row.interesting,
      message: row.message,
      reviewedAt: row.reviewedAt.toISOString(),
    });
  }

  return reviews;
}

/**
 * Saves the assistant's review of claims that are still waiting for staff. A claim that has been accepted or rejected, or does not
 * exist, is skipped. A second review of a claim replaces the first. It changes nothing about the claim itself: only staff accept or
 * reject.
 * @param options - The reviews.
 * @param options.reviews - One entry for each claim: whether it is worth a closer look and the message for staff.
 * @param options.actor - The staff member whose assistant reviewed.
 * @returns How many claims were reviewed and how many skipped.
 */
export async function saveAgentReviews(options: {
  reviews: { claimId: string; interesting: boolean; message: string }[];
  actor: { id: string; email: string | null };
}) {
  const waiting = await db
    .select({ id: claimSchema.id })
    .from(claimSchema)
    .where(
      and(
        inArray(
          claimSchema.id,
          options.reviews.map((review) => review.claimId),
        ),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.validatedAt),
        isNull(claimSchema.rejectedAt),
      ),
    );
  const open = new Set(waiting.map((row) => row.id));
  const reviews = options.reviews.filter((review) => open.has(review.claimId));

  if (reviews.length > 0) {
    await db.transaction(async (tx) => {
      for (const review of reviews) {
        // oxlint-disable-next-line no-await-in-loop -- a few dozen rows in one transaction
        await tx
          .insert(claimAgentReviewSchema)
          .values({ ...review, reviewedBy: options.actor.id })
          .onConflictDoUpdate({
            target: claimAgentReviewSchema.claimId,
            set: {
              interesting: review.interesting,
              message: review.message,
              reviewedBy: options.actor.id,
              reviewedAt: new Date(),
            },
          });
      }

      await recordStaffAction(tx, {
        actor: options.actor,
        action: 'claim_agent_reviewed',
        details: {
          reviewed: String(reviews.length),
          flagged: String(reviews.filter((review) => review.interesting).length),
          via: 'mcp',
        },
      });
    });
  }

  return { reviewed: reviews.length, skipped: options.reviews.length - reviews.length };
}

/**
 * Adds the assistant's review, when it has one, to claims waiting for staff.
 * @param items - The claims.
 * @returns The claims, each with its review or null.
 */
export async function withAgentReviews<T extends { id: string }>(items: T[]) {
  const reviews = await listAgentReviews(items.map((item) => item.id));

  return items.map((item) => ({ ...item, agentReview: reviews.get(item.id) ?? null }));
}
