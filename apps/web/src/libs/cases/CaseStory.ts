import { eq, inArray } from 'drizzle-orm';
import { listResearch } from '@/libs/analysis/Research';
import { reportedPattern } from '@/libs/cases/CaseClaims';
import { getReport } from '@/libs/cases/Reports';
import { db } from '@/libs/DB';
import { caseSchema, caseStorySchema, claimSchema } from '@/models/Schema';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';
import { previewRows } from '@/utils/cases/Preview';
import { storyMaxAgeMs, storyNote } from '@/utils/cases/StoredStory';

/**
 * Works out the story of a case from its claims and its approved reports. Counts and public findings only: no claimant is named.
 * It reads through the database as it stands, so call it after the change that made it stale has been committed.
 * @param caseId - The case id.
 * @returns The values the stored row holds.
 */
async function computeStory(caseId: string) {
  const [pattern, report, research] = await Promise.all([
    reportedPattern(caseId),
    getReport(caseId),
    listResearch(caseId),
  ]);
  const contradictions = research.flatMap((item, order) =>
    (item.report?.snapshot.checks ?? [])
      .filter((check) => check.result === 'proven_false')
      .map((check) => ({ order, platformSaid: check.claim, chainShows: check.evidence })),
  );

  return {
    kind: pattern?.type ?? null,
    claimantsSaying: pattern?.count ?? 0,
    claimantsTotal: pattern?.total ?? 0,
    confirmed: pattern?.confirmed ?? 0,
    wallets: report?.snapshot.estimate?.wallets ?? null,
    estimatedLoss: report?.snapshot.estimate?.losses ?? null,
    headline: report?.snapshot.headline ?? null,
    contradictions,
  };
}

/**
 * Rebuilds the stored story of a case. Call it after the change that affects it has been committed: a claim sent, confirmed or
 * rejected, a report approved, or a statement added or removed.
 * @param caseId - The case id.
 */
export async function refreshCaseStory(caseId: string) {
  const story = await computeStory(caseId);

  await db
    .insert(caseStorySchema)
    .values({ caseId, ...story })
    .onConflictDoUpdate({
      target: caseStorySchema.caseId,
      set: { ...story, computedAt: new Date() },
    });
}

/**
 * Rebuilds the stored story of every case a claim's platform belongs to.
 * @param platformKeys - The platform keys of the claims that changed.
 */
async function refreshForPlatforms(platformKeys: string[]) {
  if (platformKeys.length === 0) {
    return;
  }

  const cases = await db
    .select({ id: caseSchema.id })
    .from(caseSchema)
    .where(inArray(caseSchema.platformKey, platformKeys));

  await Promise.all(
    cases.map(async (found) => {
      await refreshCaseStory(found.id);
    }),
  );
}

/**
 * Rebuilds the stored story of the cases that some claims belong to. Call it after a claim is sent, confirmed or rejected.
 * @param claimIds - The claims that changed.
 */
export async function refreshStoriesForClaims(claimIds: string[]) {
  if (claimIds.length === 0) {
    return;
  }

  const rows = await db
    .select({ key: claimSchema.platformKey })
    .from(claimSchema)
    .where(inArray(claimSchema.id, claimIds));

  await refreshForPlatforms([...new Set(rows.flatMap((row) => (row.key ? [row.key] : [])))]);
}

/**
 * Reads the stored story of a case, as the case page and the MCP server tell it. A missing or old row is rebuilt first. A reader who
 * may not see every list gets the contradictions of the first statements only.
 * @param caseId - The case id.
 * @param access - How much of the case the reader may see.
 * @returns The story.
 */
export async function readCaseStory(caseId: string, access: CaseAccess) {
  let [row] = await db.select().from(caseStorySchema).where(eq(caseStorySchema.caseId, caseId));

  if (!row || Date.now() - row.computedAt.getTime() > storyMaxAgeMs) {
    await refreshCaseStory(caseId);
    [row] = await db.select().from(caseStorySchema).where(eq(caseStorySchema.caseId, caseId));
  }

  if (!row) {
    return null;
  }

  const shown = row.contradictions
    .filter((item) => access === 'full' || item.order < previewRows)
    .slice(0, 2);

  return {
    claimantsSay:
      row.kind === null
        ? null
        : {
            kind: row.kind,
            claimants: row.claimantsSaying,
            of: row.claimantsTotal,
            confirmed: row.confirmed,
            unconfirmed: row.claimantsTotal - row.confirmed,
          },
    reach:
      row.wallets !== null && row.estimatedLoss !== null
        ? { wallets: row.wallets, estimatedLoss: row.estimatedLoss }
        : null,
    platformSaidVersusChain: shown.map((item) => ({
      platformSaid: item.platformSaid,
      chainShows: item.chainShows,
    })),
    headline: row.headline,
    note: storyNote,
  };
}

export type CaseStoryView = NonNullable<Awaited<ReturnType<typeof readCaseStory>>>;
