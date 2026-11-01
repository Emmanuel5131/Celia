import { currentUser } from '@clerk/nextjs/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { actingStaff } from '@/libs/accounts/ActingContext';
import type { StaffUser } from '@/libs/accounts/ActingContext';
import { getUsersById } from '@/libs/accounts/ClerkUsers';
import { listProofFilesFor, queueLimit } from '@/libs/claims/ClaimProofs';
import { signalsFor } from '@/libs/claims/Signals';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { claimSchema } from '@/models/Schema';
import { parseAccount } from '@/utils/accounts/Account';
import { parseStaffEmails, staffAccess } from '@/utils/accounts/StaffAccess';
import { claimState } from '@/utils/claims/ClaimState';
import { getI18nPath } from '@/utils/Helpers';

/**
 * Decides whether a signed-in person can use the staff area. See `staffAccess` for the rules.
 * @param user - The signed-in person, or null.
 * @returns `allowed`, or the first reason not.
 */
export function staffDecision(
  user: { publicMetadata: UserPublicMetadata } & Pick<
    NonNullable<Awaited<ReturnType<typeof currentUser>>>,
    'primaryEmailAddress' | 'twoFactorEnabled'
  >,
) {
  const primary = user.primaryEmailAddress;
  const staffDomain = Env.STAFF_EMAIL_DOMAIN?.trim().toLowerCase();

  return staffAccess({
    staff: parseAccount(user.publicMetadata)?.staff === true,
    email: primary?.verification?.status === 'verified' ? primary.emailAddress : null,
    twoFactor: user.twoFactorEnabled,
    allowed: parseStaffEmails(Env.STAFF_EMAILS),
    domain: staffDomain === undefined || staffDomain === '' ? null : staffDomain,
    production: Env.NODE_ENV === 'production',
    twoFactorRequired: Env.STAFF_TWO_FACTOR !== 'off',
  });
}

/**
 * Runs staff actions as a staff member who has no browser session, which is how the MCP server acts for the person who signed in
 * to it. Only a route that has already checked the staff rules for that person may call it; inside, `requireStaff` returns them.
 * @param user - The staff member, already checked.
 * @param run - What to do as them.
 * @returns What `run` returns.
 */
export async function runAsStaff<T>(user: StaffUser, run: () => Promise<T>) {
  return await actingStaff.run(user, run);
}

/**
 * Lets only Celia staff through. Anyone else gets a 404, so the area does not show that it exists. Every staff page and every
 * staff action calls this first, because hiding a link is not access control. Staff who have not turned on two-step sign-in are
 * sent to do that first, unless the page is the one that helps them (`twoFactor: false`).
 * @param options - How strict to be.
 * @param options.twoFactor - Whether two-step sign-in is required; true unless set to false.
 * @returns The signed-in staff member.
 */
export async function requireStaff(options?: { twoFactor?: boolean }) {
  // An MCP call has no browser session: the route has already checked the staff rules for the token, and set who is acting.
  const acting = actingStaff.getStore();

  if (acting) {
    return acting;
  }

  const user = await currentUser();

  if (!user) {
    return notFound();
  }

  const decision = staffDecision(user);

  if (decision === 'needs_two_factor' && options?.twoFactor === false) {
    return user;
  }

  if (decision === 'needs_two_factor') {
    return redirect(getI18nPath('/dashboard/staff/secure', await getLocale()));
  }

  return decision === 'allowed' ? user : notFound();
}

/**
 * Finds the signed-in staff member for a route handler, which cannot send anyone to the two-step page the way a page can. Anyone
 * who does not pass every staff rule is simply not staff here.
 * @returns The staff member, or null.
 */
export async function currentStaff() {
  const user = await currentUser();

  return user && staffDecision(user) === 'allowed' ? user : null;
}

/**
 * Lists the oldest sent claims waiting for staff to validate, with who to write to about each one, the reasons to look closer at
 * it and the video or files the person added to show the wallet is theirs. The name and email come from Clerk and are only for staff.
 * @param options - Where to start.
 * @param options.offset - How many of the oldest claims to skip, to read the queue past the first page.
 * @returns The claims waiting.
 */
export async function listClaimsToValidate(options: { offset?: number } = {}) {
  const rows = await db
    .select({
      id: claimSchema.id,
      userId: claimSchema.userId,
      platformName: claimSchema.platformName,
      fraudType: claimSchema.fraudType,
      chain: claimSchema.chain,
      amountLost: claimSchema.amountLost,
      ownership: claimSchema.ownership,
      submittedAt: claimSchema.submittedAt,
      status: claimSchema.status,
      validatedAt: claimSchema.validatedAt,
      rejectedAt: claimSchema.rejectedAt,
      staffReviewStartedAt: claimSchema.staffReviewStartedAt,
      walletAddress: claimSchema.walletAddress,
      destinationAddress: claimSchema.destinationAddress,
      reviewVideoUrl: claimSchema.reviewVideoUrl,
      proofNote: claimSchema.proofNote,
      reviewRequestedAt: claimSchema.reviewRequestedAt,
      reviewedAt: claimSchema.reviewedAt,
      txHash: claimSchema.txHash,
      fundingTxHash: claimSchema.fundingTxHash,
      txCheck: claimSchema.txCheck,
      platformKey: claimSchema.platformKey,
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
    // The oldest first; the rest appear as these are confirmed.
    .limit(queueLimit)
    .offset(options.offset ?? 0);

  if (rows.length === 0) {
    return [];
  }

  const [signals, files, users] = await Promise.all([
    signalsFor(rows),
    listProofFilesFor(rows.map((row) => row.id)),
    getUsersById(rows.map((row) => row.userId)),
  ]);

  return rows.map((row) => {
    const user = users.get(row.userId);

    return {
      id: row.id,
      platformName: row.platformName,
      fraudType: row.fraudType,
      chain: row.chain,
      amountLost: row.amountLost,
      walletAddress: row.walletAddress,
      destinationAddress: row.destinationAddress,
      signed: row.ownership === 'signed',
      // Only sent and in-review claims are waiting; accepted and rejected ones have left the queue.
      state: claimState(row) === 'in_review' ? ('in_review' as const) : ('sent' as const),
      signals: signals.get(row.id) ?? [],
      // What the person added to show the wallet is theirs, until staff have looked at it.
      proof:
        row.reviewRequestedAt && !row.reviewedAt
          ? {
              videoUrl: row.reviewVideoUrl,
              note: row.proofNote,
              files: files.get(row.id) ?? [],
            }
          : null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
    };
  });
}

/**
 * Lists every sent claim waiting for staff, oldest first, reading the queue a page at a time because `listClaimsToValidate` loads
 * only its oldest claims at once.
 * @returns All the claims waiting.
 */
export async function listAllClaimsToValidate() {
  const claims: Awaited<ReturnType<typeof listClaimsToValidate>> = [];

  for (let offset = 0; ; offset += queueLimit) {
    // oxlint-disable-next-line no-await-in-loop -- each page is read after the one before it
    const page = await listClaimsToValidate({ offset });

    claims.push(...page);

    if (page.length < queueLimit) {
      return claims;
    }
  }
}

export type ClaimToValidate = Awaited<ReturnType<typeof listClaimsToValidate>>[number];
