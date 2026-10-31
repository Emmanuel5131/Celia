import { and, desc, eq, inArray } from 'drizzle-orm';
import { listCases } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { caseEventSchema, caseReportSchema, caseSchema, caseTeamSchema } from '@/models/Schema';
import { buildOverview } from '@/utils/cases/OverviewStats';

/**
 * Loads what a lawyer's overview shows, all from the database: every case, what has
 * happened to them, which cases they lead, and each case's newest report hash. Then `buildOverview` turns those into the
 * numbers, the list and the feed, so nothing on the page is typed in.
 * @param options - Whose overview.
 * @param options.userId - The lawyer's Clerk user id.
 * @returns The stats, the cases that need attention and the activity.
 */
export async function loadCounselOverview(options: { userId: string }) {
  const [all, created, led] = await Promise.all([
    listCases(),
    db.select({ id: caseSchema.id, createdAt: caseSchema.createdAt }).from(caseSchema),
    db
      .select({ caseId: caseTeamSchema.caseId, at: caseTeamSchema.createdAt })
      .from(caseTeamSchema)
      .where(and(eq(caseTeamSchema.userId, options.userId), eq(caseTeamSchema.role, 'lead'))),
  ]);

  const createdAt = new Map(created.map((row) => [row.id, row.createdAt.toISOString()]));
  const cases = all.map((row) => ({ ...row, createdAt: createdAt.get(row.id) ?? row.updatedAt }));
  const ids = cases.map((row) => row.id);

  const [events, reports] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select()
            .from(caseEventSchema)
            .where(inArray(caseEventSchema.caseId, ids))
            .orderBy(desc(caseEventSchema.createdAt))
            .limit(300),
          db
            .select({ caseId: caseReportSchema.caseId, hash: caseReportSchema.hash })
            .from(caseReportSchema)
            .where(
              and(inArray(caseReportSchema.caseId, ids), eq(caseReportSchema.review, 'approved')),
            )
            .orderBy(desc(caseReportSchema.version)),
        ]);

  // Newest version first, so the first hash seen for a case is its newest.
  const hashes: Record<string, string> = {};

  for (const report of reports) {
    hashes[report.caseId] ??= report.hash;
  }

  return buildOverview({
    cases,
    events: events.map((event) => ({
      caseId: event.caseId,
      type: event.type,
      count: event.count,
      at: event.createdAt.toISOString(),
    })),
    ledByYou: led.map((row) => ({ caseId: row.caseId, at: row.at.toISOString() })),
    hashes,
    now: new Date(),
  });
}
