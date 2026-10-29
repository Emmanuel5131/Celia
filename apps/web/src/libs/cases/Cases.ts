import { canTakeCase } from '@celia/core';
import type { TakeCaseInput } from '@celia/core';
import { and, count, desc, eq, isNull, max, sql } from 'drizzle-orm';
import { recordCaseEvent } from '@/libs/cases/CaseEvents';
import type { Claim } from '@/libs/claims/Claims';
import { db } from '@/libs/DB';
import { notify } from '@/libs/notifications/Notify';
import type { Executor } from '@/libs/notifications/Notify';
import { claimantIds } from '@/libs/notifications/Recipients';
import {
  caseEventSchema,
  caseReportSchema,
  caseSchema,
  counselProfileSchema,
  caseTeamSchema,
  claimSchema,
} from '@/models/Schema';
import { caseNumber, readyToBuild, sortByStatus } from '@/utils/cases/Case';
import type { CaseRow } from '@/utils/cases/Case';

/** A case with the platform key that ties it to claims. The key never reaches the browser. */
export type CaseDetail = CaseRow & { platformKey: string };

// When each case's evidence file was sealed. A claim sent after that is not part of the file, so it is not counted with the case.
const sealedEvents = db
  .select({ caseId: caseEventSchema.caseId, at: max(caseEventSchema.createdAt).as('sealed_at') })
  .from(caseEventSchema)
  .where(eq(caseEventSchema.type, 'case_sealed'))
  .groupBy(caseEventSchema.caseId)
  .as('sealed_events');

// Filters a count to the claims in the file: sent before the case was sealed, or the case is not sealed.
const sentInFile = sql`(${sealedEvents.at} is null or ${claimSchema.submittedAt} <= ${sealedEvents.at})`;

// A rejected claim never belongs to a case.
const inCase = and(
  isNull(claimSchema.rejectedAt),
  eq(claimSchema.platformKey, caseSchema.platformKey),
  eq(claimSchema.status, 'submitted'),
);

// A case is only shown once one of its claims is confirmed: until then it is not a case yet.
const hasConfirmedClaim = sql`count(${claimSchema.validatedAt}) > 0`;

// One row per case with its number of claimants (people with a submitted claim against the same platform) and how many of them staff have confirmed.
const caseSelect = {
  id: caseSchema.id,
  seq: caseSchema.seq,
  name: caseSchema.name,
  platformKey: caseSchema.platformKey,
  description: caseSchema.description,
  operators: caseSchema.operators,
  operatorJurisdictions: caseSchema.operatorJurisdictions,
  status: caseSchema.status,
  updatedAt: caseSchema.updatedAt,
  claimants:
    sql<number>`count(distinct ${claimSchema.userId}) filter (where ${sentInFile})`.mapWith(Number),
  confirmed:
    sql<number>`count(distinct ${claimSchema.userId}) filter (where ${sentInFile} and ${claimSchema.validatedAt} is not null)`.mapWith(
      Number,
    ),
  jurisdictions:
    sql<number>`count(distinct lower(${claimSchema.country})) filter (where ${sentInFile} and ${claimSchema.validatedAt} is not null)`.mapWith(
      Number,
    ),
  hasReport: sql<boolean>`exists (select 1 from ${caseReportSchema} where ${caseReportSchema.caseId} = ${caseSchema.id})`,
};

const toRow = (row: {
  id: string;
  seq: number;
  name: string;
  description: string | null;
  operators: string | null;
  operatorJurisdictions: string[];
  status: CaseRow['status'];
  updatedAt: Date;
  claimants: number;
  confirmed: number;
  jurisdictions: number;
  hasReport: boolean;
}): CaseRow => ({
  id: row.id,
  number: caseNumber(row.seq),
  name: row.name,
  description: row.description,
  operators: row.operators,
  operatorJurisdictions: row.operatorJurisdictions,
  status: row.status,
  claimants: row.claimants,
  confirmed: row.confirmed,
  jurisdictions: row.jurisdictions,
  hasReport: row.hasReport,
  updatedAt: row.updatedAt.toISOString(),
});

const toDetail = (row: Parameters<typeof toRow>[0] & { platformKey: string }): CaseDetail => ({
  ...toRow(row),
  platformKey: row.platformKey,
});

/**
 * Lists every case for the case bank, by status and then most recently changed first. Only the summary: nobody's claim is in it.
 * @returns The cases.
 */
export async function listCases() {
  const rows = await db
    .select(caseSelect)
    .from(caseSchema)
    .leftJoin(sealedEvents, eq(sealedEvents.caseId, caseSchema.id))
    .leftJoin(claimSchema, inCase)
    .groupBy(caseSchema.id, sealedEvents.at)
    .having(hasConfirmedClaim);

  return sortByStatus(rows.map(toRow));
}

/**
 * Reads one case.
 * @param id - The case id.
 * @returns The case, or undefined.
 */
export async function getCase(id: string) {
  const [row] = await db
    .select(caseSelect)
    .from(caseSchema)
    .leftJoin(sealedEvents, eq(sealedEvents.caseId, caseSchema.id))
    .leftJoin(claimSchema, inCase)
    .where(eq(caseSchema.id, id))
    .groupBy(caseSchema.id, sealedEvents.at)
    .having(hasConfirmedClaim);

  return row ? toDetail(row) : undefined;
}

/**
 * Where a case's confirmed victims are, as counts only: each country with how many claims staff have confirmed, most first. Claims
 * nobody has confirmed are not counted. It names nobody, and a country with one confirmed claim is left out of the list and counted
 * in `others`, so a single claim cannot point at one person.
 * @param caseId - The case id.
 * @returns The countries with two or more confirmed claims, and how many confirmed claims sit in the rest.
 */
export async function listAffectedCountries(caseId: string) {
  const rows = await db
    .select({ country: sql<string | null>`lower(${claimSchema.country})`, total: count() })
    .from(claimSchema)
    .innerJoin(caseSchema, eq(caseSchema.platformKey, claimSchema.platformKey))
    .where(
      and(
        eq(caseSchema.id, caseId),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.rejectedAt),
        sql`${claimSchema.validatedAt} is not null`,
      ),
    )
    .groupBy(sql`lower(${claimSchema.country})`)
    .orderBy(desc(count()));
  const named = rows.flatMap((row) =>
    row.country && row.total >= 2 ? [{ country: row.country, total: row.total }] : [],
  );

  return {
    countries: named,
    others:
      rows.reduce((sum, row) => sum + row.total, 0) -
      named.reduce((sum, row) => sum + row.total, 0),
  };
}

/**
 * The cases a lawyer's firm leads, in the order of the case bank.
 * @param userId - The Clerk user id of the lead lawyer.
 * @returns The cases.
 */
export async function listCasesLedBy(userId: string) {
  const led = await db
    .select({ caseId: caseTeamSchema.caseId })
    .from(caseTeamSchema)
    .where(and(eq(caseTeamSchema.userId, userId), eq(caseTeamSchema.role, 'lead')));
  const ids = new Set(led.map((row) => row.caseId));

  const cases = await listCases();

  return cases.filter((row) => ids.has(row.id));
}

/**
 * Moves a case from collecting claims to building evidence when it has enough confirmed claims and a big enough estimated loss.
 * It never moves a case back or past building: the team marks enough evidence. Call it in the transaction of whatever changed the
 * claims or the estimate.
 * @param executor - The transaction.
 * @param caseId - The case id.
 */
export async function advanceCase(executor: Executor, caseId: string) {
  const [found] = await executor
    .select({
      status: caseSchema.status,
      platformKey: caseSchema.platformKey,
      estimatedLossUsd: caseSchema.estimatedLossUsd,
    })
    .from(caseSchema)
    .where(eq(caseSchema.id, caseId));

  if (found?.status !== 'collecting') {
    return;
  }

  const [confirmed] = await executor
    .select({ total: count() })
    .from(claimSchema)
    .where(
      and(
        eq(claimSchema.platformKey, found.platformKey),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.rejectedAt),
        sql`${claimSchema.validatedAt} is not null`,
      ),
    );

  if (readyToBuild(confirmed?.total ?? 0, found.estimatedLossUsd)) {
    await executor.update(caseSchema).set({ status: 'building' }).where(eq(caseSchema.id, caseId));
  }
}

/**
 * Adds a claim that staff just confirmed to its case. The first confirmed claim for a platform opens the case, as collecting
 * claims. Once there is enough evidence the file is fixed, so a later claim is not added to it. Call it in the same transaction as
 * the confirmation.
 * @param executor - The transaction.
 * @param claim - The confirmed claim's platform.
 * @param claim.platformKey - The reduced platform name, or null when the operator is unknown.
 * @param claim.platformName - The platform name as the person gave it.
 * @returns The id of the case the claim joined, or null when it joined none.
 */
export async function addConfirmedClaim(
  executor: Executor,
  claim: { platformKey: string | null; platformName: string | null },
) {
  if (!claim.platformKey || !claim.platformName) {
    return null;
  }

  const [opened] = await executor
    .insert(caseSchema)
    .values({ name: claim.platformName, platformKey: claim.platformKey })
    .onConflictDoNothing()
    .returning({ id: caseSchema.id });

  if (opened) {
    await recordCaseEvent(executor, opened.id, 'case_opened');
  }

  const [found] = await executor
    .select({ id: caseSchema.id, status: caseSchema.status })
    .from(caseSchema)
    .where(eq(caseSchema.platformKey, claim.platformKey));

  if (!found || found.status === 'sealed') {
    return null;
  }

  await recordCaseEvent(executor, found.id, 'claim_added');
  await advanceCase(executor, found.id);

  return found.id;
}

/**
 * Gathers what `canTakeCase` needs to know about a lawyer and a case.
 * @param options - The question.
 * @param options.userId - The Clerk user id of the lawyer.
 * @param options.verified - Whether staff have verified them.
 * @param options.found - The case.
 * @param options.conflictsConfirmed - Whether they confirmed their firm checked conflicts.
 * @returns The input for `canTakeCase`.
 */
async function takeCaseInput(options: {
  userId: string;
  verified: boolean;
  found: CaseDetail;
  conflictsConfirmed: boolean;
}): Promise<TakeCaseInput> {
  const [lead, open, claims, profile] = await Promise.all([
    db
      .select({ id: caseTeamSchema.id })
      .from(caseTeamSchema)
      .where(and(eq(caseTeamSchema.caseId, options.found.id), eq(caseTeamSchema.role, 'lead'))),
    db
      .select({ total: count() })
      .from(caseTeamSchema)
      .where(eq(caseTeamSchema.userId, options.userId)),
    db
      .select({ id: claimSchema.id })
      .from(claimSchema)
      .where(
        and(
          eq(claimSchema.userId, options.userId),
          eq(claimSchema.platformKey, options.found.platformKey),
        ),
      ),
    db
      .select({ kind: counselProfileSchema.kind })
      .from(counselProfileSchema)
      .where(eq(counselProfileSchema.userId, options.userId)),
  ]);

  return {
    verified: options.verified,
    lawFirm: profile[0]?.kind === 'law_firm',
    caseSealed: options.found.status === 'sealed',
    caseHasLead: lead.length > 0,
    isClaimant: claims.length > 0,
    conflictsConfirmed: options.conflictsConfirmed,
    openCases: open[0]?.total ?? 0,
  };
}

/**
 * Decides whether a lawyer's firm can take a case now.
 * @param options - See `takeCaseInput`.
 * @returns `ok`, or the first reason it cannot.
 */
export async function evaluateTake(options: Parameters<typeof takeCaseInput>[0]) {
  return canTakeCase(await takeCaseInput(options));
}

/**
 * Makes a lawyer the lead of a case and marks the case as with counsel, in one step. The unique index on the lead row means
 * that when two lawyers take a case at the same moment, only one of them gets it.
 * @param options - Who takes which case.
 * @param options.caseId - The case id.
 * @param options.userId - The Clerk user id of the lawyer.
 * @returns True when they got the case, false when someone else already had it.
 */
export async function takeCase(options: { caseId: string; userId: string }) {
  return await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(caseTeamSchema)
      .values({
        caseId: options.caseId,
        userId: options.userId,
        role: 'lead',
        conflictsConfirmedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: caseTeamSchema.id });

    if (inserted.length === 0) {
      return false;
    }

    const [taken] = await tx
      .select({ platformKey: caseSchema.platformKey })
      .from(caseSchema)
      .where(eq(caseSchema.id, options.caseId));

    await recordCaseEvent(tx, options.caseId, 'case_taken');

    // Claimants are told a firm has taken the case, never which one; the firm's lead lawyer gets a confirmation.
    const claimants = taken ? await claimantIds(tx, taken.platformKey) : [];
    await notify(tx, [
      ...claimants.map((userId) => ({
        userId,
        type: 'case_taken' as const,
        dedupeKey: `case_taken:${options.caseId}`,
        data: { caseId: options.caseId },
      })),
      {
        userId: options.userId,
        type: 'case_taken_by_you' as const,
        dedupeKey: `case_taken_by_you:${options.caseId}`,
        data: { caseId: options.caseId },
      },
    ]);

    return true;
  });
}

/**
 * Whether a claim was sent after the evidence file of its case was sealed, so it is not in that file.
 * @param claim - The claim.
 * @returns True when the case was sealed before the claim was sent.
 */
export async function sentAfterSeal(claim: Pick<Claim, 'platformKey' | 'submittedAt'>) {
  if (!claim.platformKey || !claim.submittedAt) {
    return false;
  }

  const [row] = await db
    .select({ sealedAt: max(caseEventSchema.createdAt) })
    .from(caseEventSchema)
    .innerJoin(caseSchema, eq(caseSchema.id, caseEventSchema.caseId))
    .where(
      and(eq(caseSchema.platformKey, claim.platformKey), eq(caseEventSchema.type, 'case_sealed')),
    );

  return row?.sealedAt !== null && row?.sealedAt !== undefined && row.sealedAt < claim.submittedAt;
}
