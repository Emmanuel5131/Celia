import { and, asc, count, eq, inArray, isNotNull, isNull, min } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  caseSchema,
  claimSchema,
  contactRequestSchema,
  emailMessageSchema,
  institutionApplicationSchema,
} from '@/models/Schema';

// A contact request waits for staff from the moment it is sent until they say yes or no.
const waitingContact = and(
  inArray(contactRequestSchema.status, ['submitted', 'agent_reviewed']),
  isNotNull(contactRequestSchema.submittedAt),
);

/**
 * How much is waiting in each staff queue, for the numbers in the staff menu and on the overview. The true totals, even when a
 * queue page loads only its oldest rows.
 * @returns The counts.
 */
export async function staffCounts() {
  const [[applications], [claims], [contact], [mail]] = await Promise.all([
    db
      .select({ total: count() })
      .from(institutionApplicationSchema)
      .where(eq(institutionApplicationSchema.status, 'in_review')),
    db
      .select({ total: count() })
      .from(claimSchema)
      .where(
        and(
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
        ),
      ),
    db.select({ total: count() }).from(contactRequestSchema).where(waitingContact),
    db
      .select({ total: count() })
      .from(emailMessageSchema)
      .where(eq(emailMessageSchema.status, 'failed')),
  ]);

  return {
    applications: applications?.total ?? 0,
    claims: claims?.total ?? 0,
    contact: contact?.total ?? 0,
    mail: mail?.total ?? 0,
  };
}

export type StaffCounts = Awaited<ReturnType<typeof staffCounts>>;

/** One thing waiting for staff, for the "next up" list on the overview. */
export type NextUpItem = {
  id: string;
  kind: 'application' | 'claim' | 'contact';
  /** What it is: the organisation or the platform, with the amount for a claim. Empty when the person gave none. */
  detail: string;
  /** When it started waiting, as an ISO time. */
  since: string;
  /** The queue page that handles it. */
  href: string;
};

const nextUpPerQueue = 5;

/**
 * What has waited longest in each queue: the oldest applications and claims as one list, oldest first, and the date the oldest
 * failed email was queued. It names no one and shows no claim detail beyond the platform and the amount.
 * @returns The list, and when the oldest item of each queue started waiting (null when the queue is empty).
 */
export async function staffNextUp() {
  const [applications, claims, contact, [failedMail]] = await Promise.all([
    db
      .select({
        id: institutionApplicationSchema.userId,
        organisation: institutionApplicationSchema.organisation,
        since: institutionApplicationSchema.submittedAt,
      })
      .from(institutionApplicationSchema)
      .where(eq(institutionApplicationSchema.status, 'in_review'))
      .orderBy(asc(institutionApplicationSchema.submittedAt))
      .limit(nextUpPerQueue),
    db
      .select({
        id: claimSchema.id,
        platformName: claimSchema.platformName,
        amountLost: claimSchema.amountLost,
        since: claimSchema.submittedAt,
      })
      .from(claimSchema)
      .where(
        and(
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
        ),
      )
      .orderBy(asc(claimSchema.submittedAt))
      .limit(nextUpPerQueue),
    db
      .select({
        id: contactRequestSchema.id,
        caseName: caseSchema.name,
        since: contactRequestSchema.submittedAt,
      })
      .from(contactRequestSchema)
      .innerJoin(caseSchema, eq(caseSchema.id, contactRequestSchema.caseId))
      .where(waitingContact)
      .orderBy(asc(contactRequestSchema.submittedAt))
      .limit(nextUpPerQueue),
    db
      .select({ since: min(emailMessageSchema.createdAt) })
      .from(emailMessageSchema)
      .where(eq(emailMessageSchema.status, 'failed')),
  ]);

  const items = [
    ...applications.map((row) => ({
      id: row.id,
      kind: 'application' as const,
      detail: row.organisation ?? '',
      since: row.since,
      href: '/dashboard/staff/applications',
    })),
    ...claims.flatMap((row) =>
      row.since
        ? [
            {
              id: row.id,
              kind: 'claim' as const,
              detail: [row.platformName, row.amountLost].filter(Boolean).join(' · '),
              since: row.since,
              href: '/dashboard/staff/claims',
            },
          ]
        : [],
    ),
    ...contact.flatMap((row) =>
      row.since
        ? [
            {
              id: row.id,
              kind: 'contact' as const,
              detail: row.caseName,
              since: row.since,
              href: `/dashboard/staff/contact-requests/${row.id}`,
            },
          ]
        : [],
    ),
  ]
    .map((item) => ({ ...item, since: item.since.toISOString() }))
    .toSorted((a, b) => a.since.localeCompare(b.since)) satisfies NextUpItem[];

  return {
    items,
    oldest: {
      applications: applications[0]?.since.toISOString() ?? null,
      claims: claims[0]?.since?.toISOString() ?? null,
      contact: contact[0]?.since?.toISOString() ?? null,
      mail: failedMail?.since?.toISOString() ?? null,
    },
  };
}
