import type { User } from '@clerk/nextjs/server';
import { and, asc, eq } from 'drizzle-orm';
import { getUsersById } from '@/libs/accounts/ClerkUsers';
import { db } from '@/libs/DB';
import {
  counselProfileSchema,
  institutionApplicationSchema,
  staffAuditSchema,
} from '@/models/Schema';
import { canReapply, emailDomainCheck, reapplyAfterDays } from '@/utils/accounts/Institution';

const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

/**
 * Reads one person's application, for the notice they see while it is reviewed.
 * @param userId - The Clerk user id.
 * @returns Where it stands, when we aim to decide, and whether that date has passed, or undefined when they have none.
 */
export async function getApplication(userId: string) {
  const [row] = await db
    .select({
      status: institutionApplicationSchema.status,
      submittedAt: institutionApplicationSchema.submittedAt,
      reviewDueAt: institutionApplicationSchema.reviewDueAt,
      decisionNote: institutionApplicationSchema.decisionNote,
      decidedAt: institutionApplicationSchema.decidedAt,
    })
    .from(institutionApplicationSchema)
    .where(eq(institutionApplicationSchema.userId, userId));

  return (
    row && {
      ...row,
      overdue: row.reviewDueAt.getTime() < Date.now(),
      reapplyOn: row.decidedAt ? addDays(row.decidedAt, reapplyAfterDays) : null,
      canReapply:
        row.status === 'rejected' &&
        row.decidedAt !== null &&
        canReapply(row.decidedAt, new Date()),
    }
  );
}

const inReviewSelect = {
  application: institutionApplicationSchema,
  jurisdictions: counselProfileSchema.jurisdictions,
};

async function toApplications(
  rows: {
    application: typeof institutionApplicationSchema.$inferSelect;
    jurisdictions: string[] | null;
  }[],
) {
  if (rows.length === 0) {
    return [];
  }

  const users = await getUsersById(rows.map((row) => row.application.userId));
  const now = Date.now();

  return rows.map(({ application, jurisdictions }) => {
    const user = users.get(application.userId);
    const email = user?.primaryEmailAddress?.emailAddress ?? '';

    return {
      id: application.userId,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      email,
      domain: email ? emailDomainCheck(email, application.website) : 'unknown',
      kind: application.kind,
      organisation: application.organisation,
      registrationNumber: application.registrationNumber,
      website: application.website,
      contactRole: application.contactRole,
      jurisdictions: jurisdictions ?? [],
      checks: application.checks,
      lookups: application.lookups,
      lookedUpAt: application.lookedUpAt?.toISOString() ?? null,
      readyBy: application.readyBy,
      status: application.status,
      decisionNote: application.decisionNote,
      decidedAt: application.decidedAt?.toISOString() ?? null,
      submittedAt: application.submittedAt.toISOString(),
      dueAt: application.reviewDueAt.toISOString(),
      overdue: application.status === 'in_review' && application.reviewDueAt.getTime() < now,
    };
  });
}

/**
 * Lists every application, so staff can also look back at the approved and rejected ones. The ones waiting for review come
 * first, oldest first; the decided ones follow, most recently decided first. The name and email come from Clerk and are only for
 * staff.
 * @returns The applications.
 */
export async function listApplications() {
  const rows = await db
    .select(inReviewSelect)
    .from(institutionApplicationSchema)
    .leftJoin(
      counselProfileSchema,
      eq(counselProfileSchema.userId, institutionApplicationSchema.userId),
    )
    .orderBy(asc(institutionApplicationSchema.submittedAt));
  const items = await toApplications(rows);
  const waiting = items.filter((item) => item.status === 'in_review');
  const decided = items
    .filter((item) => item.status !== 'in_review')
    .toSorted((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));

  return [...waiting, ...decided];
}

/**
 * Lists only the applications still waiting for review, oldest first.
 * @returns The applications in review.
 */
export async function listApplicationsInReview() {
  const items = await listApplications();

  return items.filter((item) => item.status === 'in_review');
}

/**
 * Reads one application in any state, with the same details as the list.
 * @param userId - The Clerk user id of the applicant.
 * @returns The application, or undefined when that person has none.
 */
async function getApplicationById(userId: string) {
  const rows = await db
    .select(inReviewSelect)
    .from(institutionApplicationSchema)
    .leftJoin(
      counselProfileSchema,
      eq(counselProfileSchema.userId, institutionApplicationSchema.userId),
    )
    .where(eq(institutionApplicationSchema.userId, userId));

  const [item] = await toApplications(rows);

  return item;
}

const isoOrNull = (time: number | null | undefined) =>
  time === null || time === undefined ? null : new Date(time).toISOString();

/**
 * The facts Clerk holds about an applicant's account that staff look at.
 * @param user - The applicant, or undefined when Clerk does not know them.
 * @returns Whether the email is verified, the phones, and when they signed up and last signed in.
 */
function accountFacts(user: User | undefined) {
  return {
    emailVerified: user?.primaryEmailAddress?.verification?.status === 'verified',
    phones: user?.phoneNumbers.map((phone) => phone.phoneNumber) ?? [],
    createdAt: isoOrNull(user?.createdAt),
    lastSignInAt: isoOrNull(user?.lastSignInAt),
  };
}

/**
 * A staff member as a person reads them.
 * @param user - The staff member, or undefined when Clerk does not know them.
 * @param fallback - The id to show when there is no name or email.
 * @returns Their name, else their email, else the id.
 */
function displayName(user: User | undefined, fallback: string) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return name === '' ? (user?.primaryEmailAddress?.emailAddress ?? fallback) : name;
}

/**
 * Reads what the review page shows beyond the list row: the account, who marked it ready, and the activity on it.
 * @param item - The application as the list shows it.
 * @returns The application with its account facts, ready-by and history.
 */
async function detailOf(item: ApplicationInReview) {
  const userId = item.id;
  const [[row], audit, users] = await Promise.all([
    db
      .select({ readyAt: institutionApplicationSchema.readyAt })
      .from(institutionApplicationSchema)
      .where(eq(institutionApplicationSchema.userId, userId)),
    db
      .select()
      .from(staffAuditSchema)
      .where(
        and(eq(staffAuditSchema.targetType, 'application'), eq(staffAuditSchema.targetId, userId)),
      )
      .orderBy(asc(staffAuditSchema.createdAt)),
    getUsersById([userId, ...(item.readyBy ? [item.readyBy] : [])]),
  ]);

  return {
    item,
    account: accountFacts(users.get(userId)),
    readyAt: row?.readyAt?.toISOString() ?? null,
    readyByName: item.readyBy ? displayName(users.get(item.readyBy), item.readyBy) : null,
    history: audit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actorEmail ?? entry.actorId,
      at: entry.createdAt.toISOString(),
      details: entry.details,
    })),
  };
}

/**
 * Reads one application with everything held about it, for its page: what the applicant gave, the facts Clerk holds about their
 * account, who marked it ready and when, and the staff activity on this application, oldest first. It also reads once decided.
 * @param userId - The Clerk user id of the applicant.
 * @returns The application and its detail, or undefined when that person has none.
 */
export async function getApplicationDetail(userId: string) {
  const item = await getApplicationById(userId);

  return item ? await detailOf(item) : undefined;
}

export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;

export type ApplicationInReview = Awaited<ReturnType<typeof toApplications>>[number];

/**
 * Reads what an applicant gave, to fill the form when they apply again.
 * @param userId - The Clerk user id.
 * @returns The details, or undefined when there is no application.
 */
export async function getApplicationForm(userId: string) {
  const [row] = await db
    .select({
      kind: institutionApplicationSchema.kind,
      registrationNumber: institutionApplicationSchema.registrationNumber,
      website: institutionApplicationSchema.website,
      contactRole: institutionApplicationSchema.contactRole,
      firm: institutionApplicationSchema.organisation,
      jurisdictions: counselProfileSchema.jurisdictions,
    })
    .from(institutionApplicationSchema)
    .leftJoin(
      counselProfileSchema,
      eq(counselProfileSchema.userId, institutionApplicationSchema.userId),
    )
    .where(eq(institutionApplicationSchema.userId, userId));

  return row && { ...row, jurisdictions: row.jurisdictions ?? [] };
}
