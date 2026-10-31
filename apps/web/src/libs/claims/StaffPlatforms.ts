import { count, desc, eq, isNotNull, max, min, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { caseSchema, claimSchema } from '@/models/Schema';
import { caseNumber } from '@/utils/cases/Case';

/**
 * Lists the platforms, projects, people and groups that claims name, one row for each, most claims first. Claims that name no operator are
 * left out. A row says how many claims name it, how many staff confirmed, on which chains, when the first and latest arrived, and
 * the case it was pooled into, if any (a case has a unique platform key, so a name has at most one). A name with no website is shown as such, and the contact handle beside it, so a single person or a group is told apart from a platform.
 * @returns One row for each named operator.
 */
export async function listPlatforms() {
  const rows = await db
    .select({
      key: claimSchema.platformKey,
      name: max(claimSchema.platformName),
      host: max(claimSchema.platformHost),
      handle: max(claimSchema.operatorHandle),
      claims: count(),
      confirmed: count(claimSchema.validatedAt),
      chains: sql<string[]>`array_agg(distinct ${claimSchema.chain})`,
      firstAt: min(claimSchema.submittedAt),
      lastAt: max(claimSchema.submittedAt),
      caseId: caseSchema.id,
      caseSeq: caseSchema.seq,
    })
    .from(claimSchema)
    .leftJoin(caseSchema, eq(caseSchema.platformKey, claimSchema.platformKey))
    .where(isNotNull(claimSchema.platformKey))
    .groupBy(claimSchema.platformKey, caseSchema.id, caseSchema.seq)
    .orderBy(desc(count()), desc(max(claimSchema.submittedAt)));

  return rows.map((row) => ({
    key: row.key ?? '',
    name: row.name ?? '',
    host: row.host,
    handle: row.handle,
    claims: row.claims,
    confirmed: row.confirmed,
    chains: row.chains,
    firstAt: row.firstAt?.toISOString() ?? null,
    lastAt: row.lastAt?.toISOString() ?? null,
    caseId: row.caseId,
    caseNumber: row.caseSeq === null ? null : caseNumber(row.caseSeq),
  }));
}

export type PlatformRow = Awaited<ReturnType<typeof listPlatforms>>[number];
