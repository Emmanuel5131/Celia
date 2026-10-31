'use server';

import { getJurisdiction } from '@celia/jurisdictions';
import { clerkClient } from '@clerk/nextjs/server';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { setCounselReview } from '@/libs/accounts/CounselProfile';
import { lookupRegistry, lookupSanctions } from '@/libs/accounts/Lookups';
import { requireStaff } from '@/libs/accounts/Staff';
import { recordStaffAction, staffActor } from '@/libs/accounts/StaffAudit';
import { approveBrief } from '@/libs/analysis/Analysis';
import { addStatement, removeStatement } from '@/libs/analysis/Statements';
import { recordCaseEvent } from '@/libs/cases/CaseEvents';
import { addConfirmedClaim } from '@/libs/cases/Cases';
import { saveCheckedReport } from '@/libs/cases/Reports';
import { signalsFor } from '@/libs/claims/Signals';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { notify } from '@/libs/notifications/Notify';
import { claimantIds, verifiedCounselIds } from '@/libs/notifications/Recipients';
import { unsuppress } from '@/libs/notifications/Suppression';
import { deleteConnection } from '@/libs/sandworm/Connection';
import {
  caseReportSchema,
  caseSchema,
  claimProofSchema,
  claimSchema,
  emailMessageSchema,
  institutionApplicationSchema,
} from '@/models/Schema';
import { parseAccount } from '@/utils/accounts/Account';
import { approvalRefusal, reviewChecks } from '@/utils/accounts/Institution';
import { caseStatuses } from '@/utils/cases/Case';
import { forbiddenWords } from '@/validations/ReportValidation';

// Notes on who is alleged to have run a platform. The house language applies: they record what is alleged, they do not declare fraud.
const CaseOperatorsValidation = z.object({
  operators: z
    .string()
    .trim()
    .max(3000)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' }),
});

const ApplicationCheckValidation = z.object({
  userId: z.string().min(1),
  check: z.enum(reviewChecks),
  value: z.boolean(),
});

/**
 * Ticks or unticks one check on an application in review. Changing a check after it was marked ready takes the mark off, so the
 * person who approves always approves what was last checked.
 * @param input - The application, the check and whether it passed.
 * @param input.userId - The applicant's Clerk user id.
 * @param input.check - Which check.
 * @param input.value - Whether it passed.
 */
export async function setApplicationCheck(input: {
  userId: string;
  check: string;
  value: boolean;
}) {
  const staff = await requireStaff();
  const parsed = ApplicationCheckValidation.safeParse(input);

  if (!parsed.success) {
    return;
  }

  const { userId, check, value } = parsed.data;
  await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ checks: institutionApplicationSchema.checks })
      .from(institutionApplicationSchema)
      .where(
        and(
          eq(institutionApplicationSchema.userId, userId),
          eq(institutionApplicationSchema.status, 'in_review'),
        ),
      );

    if (!found) {
      return;
    }

    await tx
      .update(institutionApplicationSchema)
      .set({ checks: { ...found.checks, [check]: value }, readyBy: null, readyAt: null })
      .where(eq(institutionApplicationSchema.userId, userId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_checked',
      target: { type: 'application', id: userId },
      details: { check, value: String(value) },
    });
  });
  revalidatePath('/', 'layout');
}

/**
 * Runs the registry and sanctions lookups for an application and keeps what they found, for staff to read. They inform the checks;
 * staff still tick each one themselves.
 * @param userId - The applicant's Clerk user id.
 */
export async function runApplicationLookups(userId: string) {
  const staff = await requireStaff();
  const [found] = await db
    .select({ organisation: institutionApplicationSchema.organisation })
    .from(institutionApplicationSchema)
    .where(
      and(
        eq(institutionApplicationSchema.userId, userId),
        eq(institutionApplicationSchema.status, 'in_review'),
      ),
    );

  if (!found) {
    return;
  }

  const client = await clerkClient();
  const applicant = await client.users.getUser(userId);
  const [registry, sanctions] = await Promise.all([
    lookupRegistry(found.organisation),
    lookupSanctions({
      organisation: found.organisation,
      person: [applicant.firstName, applicant.lastName].filter(Boolean).join(' '),
    }),
  ]);

  await db.transaction(async (tx) => {
    await tx
      .update(institutionApplicationSchema)
      .set({ lookups: { registry, sanctions }, lookedUpAt: new Date() })
      .where(eq(institutionApplicationSchema.userId, userId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_lookup',
      target: { type: 'application', id: userId },
    });
  });
  revalidatePath('/', 'layout');
}

/**
 * Marks an application ready for a second person to approve. Every check must be ticked first.
 * @param userId - The applicant's Clerk user id.
 * @returns `checks_incomplete` when a check is still open; otherwise nothing.
 */
export async function markApplicationReady(
  userId: string,
): Promise<'ok' | 'missing' | 'checks_incomplete'> {
  const staff = await requireStaff();
  const result = await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ checks: institutionApplicationSchema.checks })
      .from(institutionApplicationSchema)
      .where(
        and(
          eq(institutionApplicationSchema.userId, userId),
          eq(institutionApplicationSchema.status, 'in_review'),
        ),
      );

    if (!found) {
      return 'missing';
    }

    if (!reviewChecks.every((check) => found.checks[check] === true)) {
      return 'checks_incomplete';
    }

    await tx
      .update(institutionApplicationSchema)
      .set({ readyBy: staff.id, readyAt: new Date() })
      .where(eq(institutionApplicationSchema.userId, userId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_ready',
      target: { type: 'application', id: userId },
    });

    return 'ok';
  });
  revalidatePath('/', 'layout');

  return result;
}

/**
 * Approves an application, which opens the account. It needs every check ticked and a second person: the one who marked it ready
 * cannot approve it in production. Only an account that is counsel and waiting for review can be approved, so this cannot be used
 * to give any other account the role.
 * @param userId - The applicant's Clerk user id.
 * @returns The reason it was refused, or `ok`.
 */
export async function approveApplication(
  userId: string,
): Promise<'ok' | 'missing' | 'checks_incomplete' | 'not_ready' | 'same_person'> {
  const staff = await requireStaff();
  const [found] = await db
    .select()
    .from(institutionApplicationSchema)
    .where(
      and(
        eq(institutionApplicationSchema.userId, userId),
        eq(institutionApplicationSchema.status, 'in_review'),
      ),
    );

  if (!found) {
    return 'missing';
  }

  const refusal = approvalRefusal({
    checks: found.checks,
    readyBy: found.readyBy,
    actor: staff.id,
    production: Env.NODE_ENV === 'production',
  });

  if (refusal !== 'ok') {
    return refusal;
  }

  const client = await clerkClient();
  const target = await client.users.getUser(userId);
  const account = parseAccount(target.publicMetadata);

  if (account?.accountType !== 'counsel' || account.review !== 'pending') {
    return 'missing';
  }

  await client.users.updateUserMetadata(userId, { publicMetadata: { review: 'verified' } });
  await db.transaction(async (tx) => {
    await tx
      .update(institutionApplicationSchema)
      .set({
        status: 'approved',
        decidedBy: staff.id,
        decidedAt: new Date(),
      })
      .where(eq(institutionApplicationSchema.userId, userId));
    await setCounselReview(tx, userId, 'verified');
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'application_approved',
      target: { type: 'application', id: userId },
    });
    await notify(tx, [
      {
        userId,
        type: 'counsel_verified',
        // A lawyer can be approved more than once (after a review reset), so the key carries the minute.
        dedupeKey: `counsel_verified:${new Date().toISOString().slice(0, 16)}`,
      },
    ]);
  });
  revalidatePath('/', 'layout');

  return 'ok';
}

const RejectionValidation = z.object({
  userId: z.string().min(1),
  note: z.string().trim().min(1).max(500),
});

/**
 * Rejects an application. The reason is kept and shown to the applicant; the account stays without access.
 * @param input - The applicant and the reason.
 * @param input.userId - The applicant's Clerk user id.
 * @param input.note - Why, in a sentence or two.
 * @returns `note` when the reason is missing; otherwise nothing.
 */
export async function rejectApplication(input: {
  userId: string;
  note: string;
}): Promise<'ok' | 'note'> {
  const staff = await requireStaff();
  const parsed = RejectionValidation.safeParse(input);

  if (!parsed.success) {
    return 'note';
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(institutionApplicationSchema)
      .set({
        status: 'rejected',
        decidedBy: staff.id,
        decidedAt: new Date(),
        decisionNote: parsed.data.note,
      })
      .where(
        and(
          eq(institutionApplicationSchema.userId, parsed.data.userId),
          eq(institutionApplicationSchema.status, 'in_review'),
        ),
      )
      .returning({ userId: institutionApplicationSchema.userId });

    if (updated) {
      await recordStaffAction(tx, {
        actor: staffActor(staff),
        action: 'application_rejected',
        target: { type: 'application', id: updated.userId },
      });
      await notify(tx, [
        {
          userId: updated.userId,
          type: 'application_rejected',
          dedupeKey: `application_rejected:${updated.userId}:${new Date().toISOString().slice(0, 16)}`,
        },
      ]);
    }
  });
  revalidatePath('/', 'layout');

  return 'ok';
}

/** What a batch did: how many it changed and how many it left alone because they had changed or could not be done. */
export type BulkResult = { done: number; skipped: number };

const ids = z.array(z.uuid()).min(1).max(100);

type Staff = Awaited<ReturnType<typeof requireStaff>>;

/**
 * Runs one change over a list of claims in a single transaction, one after another, and counts how many it changed. Each change
 * may read what the one before wrote (the first accepted claim for a platform opens its case), so they run in order.
 * @param claimIds - The claims.
 * @param change - The change for one claim; true when it changed it, false when it was no longer applicable.
 * @returns How many were changed.
 */
async function runBatch(
  claimIds: string[],
  change: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    claimId: string,
  ) => Promise<boolean>,
) {
  const results = await db.transaction(async (tx) => {
    const changed: boolean[] = [];

    for (const claimId of claimIds) {
      // oxlint-disable-next-line no-await-in-loop
      changed.push(await change(tx, claimId));
    }

    return changed;
  });
  revalidatePath('/', 'layout');

  return results.filter(Boolean).length;
}

/**
 * Confirms the video or files a person added to show the wallet is theirs, as part of accepting their claim. A wallet not already
 * confirmed by a signature is confirmed as checked by staff. Nothing is sent about it: the person hears that the claim was accepted.
 * @param tx - The transaction.
 * @param staff - The staff member.
 * @param claim - The claim and where its proof stands.
 */
async function confirmWalletProof(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  staff: Staff,
  claim: Pick<
    typeof claimSchema.$inferSelect,
    'id' | 'ownership' | 'reviewRequestedAt' | 'reviewedAt'
  >,
) {
  if (!claim.reviewRequestedAt || claim.reviewedAt) {
    return;
  }

  const confirming = claim.ownership !== 'signed';

  await tx
    .update(claimSchema)
    .set({
      reviewedAt: new Date(),
      reviewNote: null,
      ...(confirming && { ownership: 'signed', ownershipMethod: 'staff', signedAt: new Date() }),
    })
    .where(eq(claimSchema.id, claim.id));
  await recordStaffAction(tx, {
    actor: staffActor(staff),
    action: 'ownership_confirmed',
    target: { type: 'claim', id: claim.id },
    details: { method: confirming ? 'staff' : 'signature' },
  });
}

/**
 * Validates one sent claim inside a transaction: staff have checked it and the evidence the person added, including any proof of
 * the wallet, which is confirmed with it. It only works on a claim that was sent and not validated yet, and it tells the person.
 * @param tx - The transaction.
 * @param staff - The staff member.
 * @param claimId - The claim.
 * @returns True when it was validated; false when it was no longer waiting.
 */
async function validateOne(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  staff: Staff,
  claimId: string,
) {
  const [claim] = await tx
    .update(claimSchema)
    .set({ validatedAt: new Date() })
    .where(
      and(
        eq(claimSchema.id, claimId),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.validatedAt),
        isNull(claimSchema.rejectedAt),
      ),
    )
    .returning({
      userId: claimSchema.userId,
      platformKey: claimSchema.platformKey,
      platformName: claimSchema.platformName,
      ownership: claimSchema.ownership,
      reviewRequestedAt: claimSchema.reviewRequestedAt,
      reviewedAt: claimSchema.reviewedAt,
    });

  if (!claim) {
    return false;
  }

  await confirmWalletProof(tx, staff, { id: claimId, ...claim });

  // The first confirmed claim for a platform opens its case; more of them move it on.
  const caseId = await addConfirmedClaim(tx, claim);

  await recordStaffAction(tx, {
    actor: staffActor(staff),
    action: 'claim_validated',
    target: { type: 'claim', id: claimId },
  });
  await notify(tx, [
    {
      userId: claim.userId,
      type: 'claim_validated',
      dedupeKey: `claim_validated:${claimId}`,
      data: { claimId },
    },
    ...(caseId
      ? [
          {
            userId: claim.userId,
            type: 'claim_in_case' as const,
            dedupeKey: `claim_in_case:${caseId}`,
            data: { caseId },
          },
        ]
      : []),
  ]);

  return true;
}

/**
 * Validates sent claims: one or a selection of up to 100. A claim for a wallet that another person has proved they control, when
 * this claim has not proved it, is refused and counted as skipped, as is one that was validated in the meantime. The rest are
 * validated, any video or files they added for the wallet are confirmed with them, and each person is told.
 * @param claimIds - The claims.
 * @returns How many were validated and how many were skipped.
 */
export async function validateClaims(claimIds: string[]): Promise<BulkResult> {
  const staff = await requireStaff();
  const parsed = ids.safeParse(claimIds);

  if (!parsed.success) {
    return { done: 0, skipped: 0 };
  }

  // A wallet someone else has already proved they control cannot be confirmed for a claim that has not proved it.
  const found = await db.select().from(claimSchema).where(inArray(claimSchema.id, parsed.data));
  const signals = await signalsFor(found);
  const blocked = new Set(
    found
      .filter(
        (claim) =>
          claim.ownership !== 'signed' &&
          signals.get(claim.id)?.includes('wallet_signed_elsewhere'),
      )
      .map((claim) => claim.id),
  );
  const allowed = parsed.data.filter((claimId) => !blocked.has(claimId));
  const done = await runBatch(
    allowed,
    async (tx, claimId) => await validateOne(tx, staff, claimId),
  );

  return { done, skipped: parsed.data.length - done };
}

const DeclineProofValidation = z.object({
  claimId: z.uuid(),
  note: z.string().trim().min(1).max(500),
});

/**
 * Turns down the video and files a person added for their wallet and asks for new ones, while the claim stays in the queue. Their
 * files are deleted and their link forgotten so they are not kept, and the reason is shown to them on the claim. A wallet confirmed
 * by signature stays confirmed. It only works on a claim still waiting with proof nobody has looked at.
 * @param input - The claim and the reason.
 * @param input.claimId - The claim.
 * @param input.note - Why the proof was not enough.
 * @returns How many were changed and skipped, or `error` when the claim or the reason is missing.
 */
export async function declineWalletProof(input: {
  claimId: string;
  note: string;
}): Promise<BulkResult & { error?: 'note' }> {
  const staff = await requireStaff();
  const parsed = DeclineProofValidation.safeParse(input);

  if (!parsed.success) {
    return { done: 0, skipped: 0, error: 'note' };
  }

  const { claimId, note } = parsed.data;
  const done = await runBatch([claimId], async (tx) => {
    const [claim] = await tx
      .select({ ownership: claimSchema.ownership })
      .from(claimSchema)
      .where(
        and(
          eq(claimSchema.id, claimId),
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
          isNotNull(claimSchema.reviewRequestedAt),
          isNull(claimSchema.reviewedAt),
        ),
      );

    if (!claim) {
      return false;
    }

    await tx.delete(claimProofSchema).where(eq(claimProofSchema.claimId, claimId));
    await tx
      .update(claimSchema)
      .set({
        ownership: claim.ownership === 'review' ? 'unsigned' : claim.ownership,
        reviewNote: note,
        reviewVideoUrl: null,
        proofNote: null,
        reviewRequestedAt: null,
      })
      .where(eq(claimSchema.id, claimId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'ownership_declined',
      target: { type: 'claim', id: claimId },
    });

    return true;
  });

  return { done, skipped: 1 - done };
}

/**
 * Marks sent claims as in review: a member of staff has started on them. The person sees it on the claim and in the app. It only
 * works on a claim that is sent, not yet in review and not settled; any other is skipped.
 * @param claimIds - The claims.
 * @returns How many were changed and how many were skipped.
 */
export async function startClaimReviews(claimIds: string[]): Promise<BulkResult> {
  const staff = await requireStaff();
  const parsed = ids.safeParse(claimIds);

  if (!parsed.success) {
    return { done: 0, skipped: 0 };
  }

  const done = await runBatch(parsed.data, async (tx, claimId) => {
    const [claim] = await tx
      .update(claimSchema)
      .set({ staffReviewStartedAt: new Date() })
      .where(
        and(
          eq(claimSchema.id, claimId),
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
          isNull(claimSchema.staffReviewStartedAt),
        ),
      )
      .returning({ userId: claimSchema.userId });

    if (!claim) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'claim_review_started',
      target: { type: 'claim', id: claimId },
    });
    await notify(tx, [
      {
        userId: claim.userId,
        type: 'claim_in_review',
        dedupeKey: `claim_in_review:${claimId}`,
        data: { claimId },
      },
    ]);

    return true;
  });

  return { done, skipped: parsed.data.length - done };
}

const RejectClaimsValidation = z.object({ claimIds: ids, note: z.string().trim().min(1).max(500) });

/**
 * Rejects sent claims: one or a selection of up to 100, all with the same reason, which each person sees on their claim and in an
 * email. A rejected claim leaves the queue and never joins a case. A claim already accepted or rejected is skipped.
 * @param input - The claims and the reason.
 * @param input.claimIds - The claims.
 * @param input.note - Why they were rejected.
 * @returns How many were changed and skipped, or `error` when the reason is missing.
 */
export async function rejectClaims(input: {
  claimIds: string[];
  note: string;
}): Promise<BulkResult & { error?: 'note' }> {
  const staff = await requireStaff();
  const parsed = RejectClaimsValidation.safeParse(input);

  if (!parsed.success) {
    return { done: 0, skipped: 0, error: 'note' };
  }

  const { claimIds, note } = parsed.data;
  const done = await runBatch(claimIds, async (tx, claimId) => {
    const [claim] = await tx
      .update(claimSchema)
      .set({ rejectedAt: new Date(), rejectionNote: note })
      .where(
        and(
          eq(claimSchema.id, claimId),
          eq(claimSchema.status, 'submitted'),
          isNull(claimSchema.validatedAt),
          isNull(claimSchema.rejectedAt),
        ),
      )
      .returning({ userId: claimSchema.userId });

    if (!claim) {
      return false;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'claim_rejected',
      target: { type: 'claim', id: claimId },
    });
    await notify(tx, [
      {
        userId: claim.userId,
        type: 'claim_rejected',
        dedupeKey: `claim_rejected:${claimId}`,
        data: { claimId },
      },
    ]);

    return true;
  });

  return { done, skipped: claimIds.length - done };
}

/**
 * Saves who the claimants allege ran a platform: notes with names and links, and the jurisdictions the operators are linked to.
 * An empty note and no jurisdictions clear them. The text must keep to the house language, because it records an allegation and never declares fraud.
 * @param caseId - The case id.
 * @param formData - The submitted form, with `operators` and any number of `jurisdictions`.
 * @returns The names of the fields that failed: `words` when the text declares fraud, `operators` when it is too long,
 *   `jurisdictions` when one is not a known jurisdiction.
 */
export async function saveCaseOperators(caseId: string, formData: FormData) {
  const staff = await requireStaff();
  const entry = formData.get('operators');
  const parsed = CaseOperatorsValidation.safeParse({
    operators: typeof entry === 'string' ? entry : '',
  });

  if (!parsed.success) {
    return parsed.error.issues.some((issue) => issue.message === 'forbidden_words')
      ? ['words']
      : ['operators'];
  }

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const jurisdictions = [
    ...new Set(
      formData.getAll('jurisdictions').filter((id) => typeof id === 'string' && id !== ''),
    ),
  ];

  if (
    jurisdictions.length > 20 ||
    !jurisdictions.every((id) => typeof id === 'string' && getJurisdiction(id))
  ) {
    return ['jurisdictions'];
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(caseSchema)
      .set({
        operators: parsed.data.operators || null,
        operatorJurisdictions: jurisdictions.filter((id) => typeof id === 'string'),
      })
      .where(eq(caseSchema.id, caseId))
      .returning({ id: caseSchema.id });

    if (updated.length === 0) {
      return;
    }

    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_operators_saved',
      target: { type: 'case', id: caseId },
    });
  });
  revalidatePath('/', 'layout');

  return [];
}

/**
 * Moves a case between the stages staff control: building and enough evidence.
 * @param caseId - The case id.
 * @param status - The new status.
 */
export async function setCaseStatus(caseId: string, status: string) {
  const staff = await requireStaff();
  const parsed = z.enum(caseStatuses).safeParse(status);

  if (!parsed.success) {
    return;
  }

  const next = parsed.data;
  await db.transaction(async (tx) => {
    const [found] = await tx.select().from(caseSchema).where(eq(caseSchema.id, caseId));

    if (!found || found.status === next) {
      return;
    }

    // A case cannot be sealed without a report: sealing says the evidence file is finished.
    if (next === 'sealed') {
      const [report] = await tx
        .select({ id: caseReportSchema.id })
        .from(caseReportSchema)
        .where(eq(caseReportSchema.caseId, caseId))
        .limit(1);

      if (!report) {
        return;
      }
    }

    await tx.update(caseSchema).set({ status: next }).where(eq(caseSchema.id, caseId));
    await recordStaffAction(tx, {
      actor: staffActor(staff),
      action: 'case_status_set',
      target: { type: 'case', id: caseId },
      details: { status: next },
    });

    if (next === 'sealed') {
      await recordCaseEvent(tx, caseId, 'case_sealed');
    }

    // Sealing is the one stage people are told about: claimants hear their evidence is final, and lawyers hear it can be taken.
    if (next === 'sealed') {
      const [claimants, counsel] = await Promise.all([
        claimantIds(tx, found.platformKey),
        verifiedCounselIds(tx),
      ]);
      await notify(tx, [
        ...claimants.map((userId) => ({
          userId,
          type: 'case_sealed' as const,
          dedupeKey: `case_sealed:${caseId}`,
          data: { caseId },
        })),
        ...counsel.map((userId) => ({
          userId,
          type: 'case_ready_for_counsel' as const,
          dedupeKey: `case_ready_for_counsel:${caseId}`,
          data: { caseId },
        })),
      ]);
    }
  });
  revalidatePath('/', 'layout');
}

/**
 * Puts a failed email back in the queue to be tried again, for when the cause (a wrong setting, a down server) is fixed.
 * @param id - The message id.
 */
export async function retryMail(id: string) {
  const staff = await requireStaff();
  await db
    .update(emailMessageSchema)
    .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null })
    .where(eq(emailMessageSchema.id, id));
  await recordStaffAction(db, {
    actor: staffActor(staff),
    action: 'mail_retried',
    target: { type: 'email', id },
  });
  revalidatePath('/', 'layout');
}

/**
 * Lets mail go to an address again, after the reason it was stopped is fixed.
 * @param email - The address.
 */
export async function allowMail(email: string) {
  const staff = await requireStaff();
  await unsuppress(email);
  // The address itself is a person's detail, so the record only says that an address was allowed.
  await recordStaffAction(db, { actor: staffActor(staff), action: 'mail_allowed' });
  revalidatePath('/', 'layout');
}

/**
 * Forgets the signed-in staff member's own Sandworm login. Each person can only disconnect themselves.
 */
export async function disconnectSandworm() {
  const staff = await requireStaff();
  await deleteConnection(staff.id);
  await recordStaffAction(db, { actor: staffActor(staff), action: 'sandworm_disconnected' });
  revalidatePath('/', 'layout');
}

/**
 * Adds a public statement the platform made to a case, for a check to compare with what the chain shows.
 * @param caseId - The case id.
 * @param formData - The form with `kind`, `text` and `sourceUrl`.
 * @returns The names of what failed: `case`, `invalid`, `words` (a wording the report would refuse) or `full`; none when added.
 */
export async function addPlatformStatement(caseId: string, formData: FormData) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const field = (name: string) => {
    const entry = formData.get(name);

    return typeof entry === 'string' && entry.trim() !== '' ? entry : undefined;
  };

  const result = await addStatement({
    caseId,
    input: {
      kind: field('kind'),
      text: field('text'),
      sourceUrl: field('sourceUrl'),
    },
    actor: staffActor(staff),
  });
  revalidatePath('/', 'layout');

  return result === 'ok' ? [] : [result];
}

/**
 * Removes a platform statement from a case.
 * @param caseId - The case id.
 * @param statementId - The statement id.
 */
export async function removePlatformStatement(caseId: string, statementId: string) {
  const staff = await requireStaff();

  if (z.uuid().safeParse(caseId).success && z.uuid().safeParse(statementId).success) {
    await removeStatement({ caseId, id: statementId, actor: staffActor(staff) });
    revalidatePath('/', 'layout');
  }
}

/**
 * Approves the analysis brief for a case: the decision to spend the compute. Preflight runs again first, so a brief that no longer
 * passes is not approved. Only a person can do this; the assistant has no tool for it.
 * @param caseId - The case id.
 * @returns `approved` with the run number, `blocked` with what stops it, or `missing` when there is no such case.
 */
export async function approveAnalysisBrief(caseId: string) {
  const staff = await requireStaff();

  if (!z.uuid().safeParse(caseId).success) {
    return { status: 'missing' as const };
  }

  const result = await approveBrief({ caseId, actor: staffActor(staff) });
  revalidatePath('/', 'layout');

  if (!result) {
    return { status: 'missing' as const };
  }

  return result.status === 'approved'
    ? { status: 'approved' as const, run: result.approved.run }
    : { status: 'blocked' as const, problems: result.problems };
}

/**
 * Saves a report for a case from the findings JSON an analysis produced. The text is checked against the report format and the
 * house language, hashed, and stored as a new version. Staff review it first: this is the last check before it is shown to
 * lawyers.
 * @param caseId - The case id.
 * @param formData - The form with `report` (the JSON).
 * @returns The problems found, or none when saved: `json`, `schema`, `words`, `table` (a test has no table), `loss` (the estimate
 *   has no dollar amount that can be read) or `case`.
 */
export async function saveCaseReport(caseId: string, formData: FormData) {
  const user = await requireStaff();

  if (!z.uuid().safeParse(caseId).success) {
    return ['case'];
  }

  const raw = formData.get('report');
  let json: unknown;

  // Pasted text may be anything, so parsing it is the one place a throw is expected.
  try {
    json = JSON.parse(typeof raw === 'string' ? raw : '');
  } catch {
    return ['json'];
  }

  const problem = await saveCheckedReport({ caseId, json, actor: staffActor(user) });

  if (problem) {
    return [problem];
  }

  revalidatePath('/', 'layout');

  return [];
}
