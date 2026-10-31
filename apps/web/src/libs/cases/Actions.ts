import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { caseActionSchema } from '@/models/Schema';

/**
 * Lists the actions the claimants allege against a case's suspected people and groups, the dated ones first and the rest in the
 * order they were added.
 * @param caseId - The case id.
 * @returns The alleged actions.
 */
export async function listActions(caseId: string) {
  const rows = await db
    .select()
    .from(caseActionSchema)
    .where(eq(caseActionSchema.caseId, caseId))
    .orderBy(sql`${caseActionSchema.occurredOn} asc nulls last`, asc(caseActionSchema.createdAt));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    note: row.note,
    occurredOn: row.occurredOn,
    jurisdiction: row.jurisdiction,
  }));
}
