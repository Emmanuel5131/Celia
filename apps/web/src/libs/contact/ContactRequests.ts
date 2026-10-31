import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { getUsersById } from '@/libs/accounts/ClerkUsers';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { notify } from '@/libs/notifications/Notify';
import {
  caseSchema,
  claimSchema,
  contactRequestClaimSchema,
  contactRequestSchema,
  institutionApplicationSchema,
} from '@/models/Schema';
import type { AgentReportReview } from '@/utils/cases/ReportReview';
import { mayBeAsked } from '@/utils/contact/ContactRequest';
import type { ContactStep } from '@/utils/contact/ContactRequest';
import {
  MessageValidation,
  RulesValidation,
  WhoValidation,
  WhyValidation,
} from '@/validations/ContactRequestValidation';

type Actor = { id: string; email: string | null };

/**
 * Finds the request an organisation is filling in for a case, or starts one. An organisation has one draft at a time for a case,
 * so coming back later continues where it stopped.
 * @param options - Whose draft.
 * @param options.caseId - The case id.
 * @param options.requesterId - The organisation's Clerk user id.
 * @returns The draft.
 */
export async function getOrStartDraft(options: { caseId: string; requesterId: string }) {
  const [existing] = await db
    .select()
    .from(contactRequestSchema)
    .where(
      and(
        eq(contactRequestSchema.caseId, options.caseId),
        eq(contactRequestSchema.requesterId, options.requesterId),
        eq(contactRequestSchema.status, 'draft'),
      ),
    );

  if (existing) {
    return existing;
  }

  const [created] = await db.insert(contactRequestSchema).values(options).returning();

  return created;
}

/**
 * Saves one step of a draft. Only the organisation's own draft can change, and each step is checked on its own.
 * @param options - The step.
 * @param options.requestId - The request id.
 * @param options.requesterId - The organisation's Clerk user id.
 * @param options.step - Which step.
 * @param options.input - What was entered, as raw values.
 * @returns `ok`, or the name of what failed: `state` (no such draft of yours) or `invalid` with the reason.
 */
export async function saveStep(options: {
  requestId: string;
  requesterId: string;
  step: Exclude<ContactStep, 'review'>;
  input: unknown;
}) {
  const where = and(
    eq(contactRequestSchema.id, options.requestId),
    eq(contactRequestSchema.requesterId, options.requesterId),
    eq(contactRequestSchema.status, 'draft'),
  );
  let values: Partial<typeof contactRequestSchema.$inferInsert>;

  if (options.step === 'who') {
    const parsed = WhoValidation.safeParse(options.input);

    if (!parsed.success) {
      return { problem: 'invalid' as const, issues: parsed.error.issues.map((i) => i.message) };
    }

    values = {
      purpose: parsed.data.purpose,
      askerRole: parsed.data.askerRole,
      purposeOther: parsed.data.purpose === 'other' ? parsed.data.purposeOther : null,
    };
  } else if (options.step === 'why') {
    const parsed = WhyValidation.safeParse(options.input);

    if (!parsed.success) {
      return { problem: 'invalid' as const, issues: parsed.error.issues.map((i) => i.message) };
    }

    values = parsed.data;
  } else if (options.step === 'rules') {
    const parsed = RulesValidation.safeParse(options.input);

    if (!parsed.success) {
      return { problem: 'invalid' as const, issues: parsed.error.issues.map((i) => i.message) };
    }

    values = { declarations: parsed.data.declarations };
  } else {
    const parsed = MessageValidation.safeParse(options.input);

    if (!parsed.success) {
      return { problem: 'invalid' as const, issues: parsed.error.issues.map((i) => i.message) };
    }

    values = parsed.data;
  }

  const [saved] = await db
    .update(contactRequestSchema)
    .set({ ...values, updatedAt: new Date() })
    .where(where)
    .returning({ id: contactRequestSchema.id });

  return saved ? { problem: null } : { problem: 'state' as const };
}

/**
 * Sends a finished draft for review. Every step must be filled in and valid, whatever the browser said, because the draft is read
 * again here.
 * @param options - The request.
 * @param options.requestId - The request id.
 * @param options.requesterId - The organisation's Clerk user id.
 * @returns `ok`, `state` (no such draft of yours) or `incomplete` (a step is missing or no longer valid).
 */
export async function submitRequest(options: { requestId: string; requesterId: string }) {
  const [draft] = await db
    .select()
    .from(contactRequestSchema)
    .where(
      and(
        eq(contactRequestSchema.id, options.requestId),
        eq(contactRequestSchema.requesterId, options.requesterId),
        eq(contactRequestSchema.status, 'draft'),
      ),
    );

  if (!draft) {
    return 'state' as const;
  }

  const complete =
    WhoValidation.safeParse({
      purpose: draft.purpose,
      purposeOther: draft.purposeOther ?? undefined,
      askerRole: draft.askerRole,
    }).success &&
    WhyValidation.safeParse({ reason: draft.reason }).success &&
    RulesValidation.safeParse({ declarations: draft.declarations }).success &&
    MessageValidation.safeParse({ message: draft.message }).success;

  if (!complete) {
    return 'incomplete' as const;
  }

  const [sent] = await db
    .update(contactRequestSchema)
    .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contactRequestSchema.id, draft.id), eq(contactRequestSchema.status, 'draft')))
    .returning({ id: contactRequestSchema.id });

  return sent ? ('ok' as const) : ('state' as const);
}

/**
 * The name an organisation goes by, from its approved application.
 * @param userIds - The organisations' Clerk user ids.
 * @returns The name of each, by user id; one without a name is left out.
 */
async function organisationNames(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db
    .select({
      id: institutionApplicationSchema.userId,
      name: institutionApplicationSchema.organisation,
    })
    .from(institutionApplicationSchema)
    .where(inArray(institutionApplicationSchema.userId, userIds));

  return new Map(rows.flatMap((row) => (row.name ? [[row.id, row.name] as const] : [])));
}

/**
 * Lists an organisation's own requests, newest first.
 * @param requesterId - The organisation's Clerk user id.
 * @returns The requests, with the case name.
 * @public
 */
export async function listOwnRequests(requesterId: string) {
  return await db
    .select({
      id: contactRequestSchema.id,
      caseId: contactRequestSchema.caseId,
      caseName: caseSchema.name,
      status: contactRequestSchema.status,
      decisionNote: contactRequestSchema.decisionNote,
      releasedAt: contactRequestSchema.releasedAt,
      createdAt: contactRequestSchema.createdAt,
    })
    .from(contactRequestSchema)
    .innerJoin(caseSchema, eq(caseSchema.id, contactRequestSchema.caseId))
    .where(eq(contactRequestSchema.requesterId, requesterId))
    .orderBy(desc(contactRequestSchema.createdAt));
}

/**
 * The requests staff look at, newest first, with the case and the organisation's name. Drafts are not shown: an organisation is
 * still writing them.
 * @returns The requests.
 */
export async function listForStaff() {
  const rows = await db
    .select({
      id: contactRequestSchema.id,
      caseId: contactRequestSchema.caseId,
      caseName: caseSchema.name,
      requesterId: contactRequestSchema.requesterId,
      status: contactRequestSchema.status,
      purpose: contactRequestSchema.purpose,
      submittedAt: contactRequestSchema.submittedAt,
      releasedAt: contactRequestSchema.releasedAt,
    })
    .from(contactRequestSchema)
    .innerJoin(caseSchema, eq(caseSchema.id, contactRequestSchema.caseId))
    .where(isNotNull(contactRequestSchema.submittedAt))
    .orderBy(desc(contactRequestSchema.submittedAt));
  const names = await organisationNames(rows.map((row) => row.requesterId));

  return rows.map((row) => ({ ...row, organisation: names.get(row.requesterId) ?? null }));
}

/**
 * Reads one submitted request for staff, with the counts of how many claimants it would ask and how many have answered. No claimant
 * is named.
 * @param id - The request id.
 * @returns The request, or null when there is none or it is still a draft.
 */
export async function getForStaff(id: string) {
  const [request] = await db
    .select({ request: contactRequestSchema, caseName: caseSchema.name })
    .from(contactRequestSchema)
    .innerJoin(caseSchema, eq(caseSchema.id, contactRequestSchema.caseId))
    .where(and(eq(contactRequestSchema.id, id), isNotNull(contactRequestSchema.submittedAt)));

  if (!request) {
    return null;
  }

  const answers = await db
    .select({ answer: contactRequestClaimSchema.answer })
    .from(contactRequestClaimSchema)
    .where(eq(contactRequestClaimSchema.requestId, id));
  const names = await organisationNames([request.request.requesterId]);

  return {
    ...request.request,
    caseName: request.caseName,
    organisation: names.get(request.request.requesterId) ?? null,
    asked: answers.length,
    accepted: answers.filter((row) => row.answer === 'accepted').length,
    declined: answers.filter((row) => row.answer === 'declined').length,
  };
}

/**
 * Records the assistant's review of a submitted request, with the message it prepared for staff.
 * @param options - The review.
 * @param options.requestId - The request id.
 * @param options.verdict - `pass`, or `concerns` when staff should look closely.
 * @param options.message - The assistant's message to staff.
 * @param options.actor - The staff member whose assistant reviewed.
 * @returns `ok`, or `state` when the request is not waiting for review.
 * @public
 */
export async function reviewRequestByAgent(options: {
  requestId: string;
  verdict: AgentReportReview['verdict'];
  message: string;
  actor: Actor;
}) {
  return await db.transaction(async (tx) => {
    const [changed] = await tx
      .update(contactRequestSchema)
      .set({
        status: 'agent_reviewed',
        agentReview: {
          verdict: options.verdict,
          message: options.message,
          at: new Date().toISOString(),
        },
      })
      .where(
        and(
          eq(contactRequestSchema.id, options.requestId),
          eq(contactRequestSchema.status, 'submitted'),
        ),
      )
      .returning({ id: contactRequestSchema.id });

    if (!changed) {
      return 'state' as const;
    }

    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'contact_request_reviewed',
      target: { type: 'contact_request', id: options.requestId },
      details: { verdict: options.verdict, via: 'mcp' },
    });

    return 'ok' as const;
  });
}

/**
 * Staff's yes or no to a submitted request, whether or not the assistant has reviewed it yet; the assistant's note is advice and
 * staff decide. A no ends it and tells the organisation. A yes asks the claimants: one row
 * and one notification for each confirmed, not rejected claim of the case whose owner agreed on the claim form to receive requests.
 * A claim without that agreement is never asked.
 * @param options - The decision.
 * @param options.requestId - The request id.
 * @param options.approve - True for yes.
 * @param options.note - The reason for a no, which the organisation sees.
 * @param options.actor - The staff member.
 * @returns `ok` with how many claimants were asked, or `state` when the request is not waiting for a decision.
 */
export async function decideRequest(options: {
  requestId: string;
  approve: boolean;
  note?: string;
  actor: Actor;
}) {
  return await db.transaction(async (tx) => {
    const [request] = await tx
      .update(contactRequestSchema)
      .set({
        status: options.approve ? 'approved' : 'rejected',
        decidedBy: options.actor.id,
        decidedAt: new Date(),
        decisionNote: options.approve ? null : (options.note ?? null),
      })
      .where(
        and(
          eq(contactRequestSchema.id, options.requestId),
          inArray(contactRequestSchema.status, ['submitted', 'agent_reviewed']),
        ),
      )
      .returning();

    if (!request) {
      return { problem: 'state' as const };
    }

    let asked = 0;

    if (options.approve) {
      const claims = await tx
        .select({
          id: claimSchema.id,
          userId: claimSchema.userId,
          validatedAt: claimSchema.validatedAt,
          rejectedAt: claimSchema.rejectedAt,
          contactAgreedAt: claimSchema.contactAgreedAt,
        })
        .from(claimSchema)
        .innerJoin(caseSchema, eq(caseSchema.platformKey, claimSchema.platformKey))
        .where(and(eq(caseSchema.id, request.caseId), eq(claimSchema.status, 'submitted')));
      const askable = claims.filter((claim) => mayBeAsked(claim));

      if (askable.length > 0) {
        await tx
          .insert(contactRequestClaimSchema)
          .values(
            askable.map((claim) => ({
              requestId: request.id,
              claimId: claim.id,
              userId: claim.userId,
            })),
          )
          .onConflictDoNothing();
        await notify(
          tx,
          askable.map((claim) => ({
            userId: claim.userId,
            type: 'contact_request' as const,
            dedupeKey: `contact_request:${request.id}:${claim.id}`,
            data: { requestId: request.id },
          })),
        );
      }

      asked = askable.length;
    }

    await notify(tx, [
      {
        userId: request.requesterId,
        type: 'contact_request_decided',
        dedupeKey: `contact_request_decided:${request.id}`,
        data: { requestId: request.id },
      },
    ]);
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'contact_request_decided',
      target: { type: 'contact_request', id: request.id },
      details: { approved: String(options.approve), asked: String(asked) },
    });

    return { problem: null, asked };
  });
}

/**
 * What a claimant sees of the requests waiting for their answer: who is asking, why and the words the organisation wrote. Nothing
 * about the claimant is in it, and it holds no other claimant.
 * @param userId - The claimant's Clerk user id.
 * @returns Their requests, newest first.
 * @public
 */
export async function listRequestsForClaimant(userId: string) {
  const rows = await db
    .select({
      id: contactRequestClaimSchema.id,
      answer: contactRequestClaimSchema.answer,
      requesterId: contactRequestSchema.requesterId,
      caseName: caseSchema.name,
      purpose: contactRequestSchema.purpose,
      message: contactRequestSchema.message,
      createdAt: contactRequestClaimSchema.createdAt,
    })
    .from(contactRequestClaimSchema)
    .innerJoin(
      contactRequestSchema,
      eq(contactRequestSchema.id, contactRequestClaimSchema.requestId),
    )
    .innerJoin(caseSchema, eq(caseSchema.id, contactRequestSchema.caseId))
    .where(
      and(
        eq(contactRequestClaimSchema.userId, userId),
        eq(contactRequestSchema.status, 'approved'),
      ),
    )
    .orderBy(desc(contactRequestClaimSchema.createdAt));
  const names = await organisationNames(rows.map((row) => row.requesterId));

  return rows.map(({ requesterId, ...row }) => ({
    ...row,
    organisation: names.get(requesterId) ?? null,
  }));
}

/**
 * A claimant's answer to one request. Only the claim's owner can answer, once, while it is pending; a refusal is final and nothing
 * about the claimant is ever shared for it. Answering after staff released the request is refused, so a yes cannot slip in later.
 * @param options - The answer.
 * @param options.id - The id of the claimant's row for the request.
 * @param options.userId - The claimant's Clerk user id.
 * @param options.accept - True for yes.
 * @returns `ok`, or `state` when there is nothing of theirs waiting for an answer.
 * @public
 */
export async function answerRequest(options: { id: string; userId: string; accept: boolean }) {
  const [row] = await db
    .select({ id: contactRequestClaimSchema.id, requestId: contactRequestClaimSchema.requestId })
    .from(contactRequestClaimSchema)
    .innerJoin(
      contactRequestSchema,
      eq(contactRequestSchema.id, contactRequestClaimSchema.requestId),
    )
    .where(
      and(
        eq(contactRequestClaimSchema.id, options.id),
        eq(contactRequestClaimSchema.userId, options.userId),
        eq(contactRequestClaimSchema.answer, 'pending'),
        eq(contactRequestSchema.status, 'approved'),
        isNull(contactRequestSchema.releasedAt),
      ),
    );

  if (!row) {
    return 'state' as const;
  }

  const [changed] = await db
    .update(contactRequestClaimSchema)
    .set({ answer: options.accept ? 'accepted' : 'declined', answeredAt: new Date() })
    .where(
      and(
        eq(contactRequestClaimSchema.id, row.id),
        eq(contactRequestClaimSchema.answer, 'pending'),
      ),
    )
    .returning({ id: contactRequestClaimSchema.id });

  return changed ? ('ok' as const) : ('state' as const);
}

/**
 * Staff's final check: after the claimants have answered, staff release the ones who said yes to the organisation. Until then the
 * organisation sees nothing about them. Releasing once closes the request to further answers.
 * @param options - The release.
 * @param options.requestId - The request id.
 * @param options.actor - The staff member.
 * @returns `ok` with how many claimants were released, or `state` when the request is not approved or was already released.
 * @public
 */
export async function releaseRequest(options: { requestId: string; actor: Actor }) {
  return await db.transaction(async (tx) => {
    const [request] = await tx
      .update(contactRequestSchema)
      .set({ releasedBy: options.actor.id, releasedAt: new Date() })
      .where(
        and(
          eq(contactRequestSchema.id, options.requestId),
          eq(contactRequestSchema.status, 'approved'),
          isNull(contactRequestSchema.releasedAt),
        ),
      )
      .returning({ id: contactRequestSchema.id, requesterId: contactRequestSchema.requesterId });

    if (!request) {
      return { problem: 'state' as const };
    }

    const accepted = await tx
      .select({ id: contactRequestClaimSchema.id })
      .from(contactRequestClaimSchema)
      .where(
        and(
          eq(contactRequestClaimSchema.requestId, request.id),
          eq(contactRequestClaimSchema.answer, 'accepted'),
        ),
      );

    await notify(tx, [
      {
        userId: request.requesterId,
        type: 'contact_request_decided',
        dedupeKey: `contact_request_released:${request.id}`,
        data: { requestId: request.id },
      },
    ]);
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'contact_request_released',
      target: { type: 'contact_request', id: request.id },
      details: { released: String(accepted.length) },
    });

    return { problem: null, released: accepted.length };
  });
}

/**
 * The claimants an organisation may contact: only those who said yes to its request, and only after staff released it. Their name
 * and email are read from their account at this moment, so a claimant who later closed their account is not shown.
 * @param options - The request.
 * @param options.requestId - The request id.
 * @param options.requesterId - The organisation's Clerk user id; another organisation gets nothing.
 * @returns The claimants who agreed, or an empty list.
 * @public
 */
export async function listReleasedContacts(options: { requestId: string; requesterId: string }) {
  const rows = await db
    .select({ userId: contactRequestClaimSchema.userId })
    .from(contactRequestClaimSchema)
    .innerJoin(
      contactRequestSchema,
      eq(contactRequestSchema.id, contactRequestClaimSchema.requestId),
    )
    .where(
      and(
        eq(contactRequestSchema.id, options.requestId),
        eq(contactRequestSchema.requesterId, options.requesterId),
        eq(contactRequestSchema.status, 'approved'),
        isNotNull(contactRequestSchema.releasedAt),
        eq(contactRequestClaimSchema.answer, 'accepted'),
      ),
    );
  const users = await getUsersById([...new Set(rows.map((row) => row.userId))]);

  return [...users.values()].map((user) => ({
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    email: user.primaryEmailAddress?.emailAddress ?? null,
  }));
}
