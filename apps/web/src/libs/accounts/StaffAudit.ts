import { desc } from 'drizzle-orm';
import { actingStaff } from '@/libs/accounts/ActingContext';
import { db } from '@/libs/DB';
import type { Executor } from '@/libs/notifications/Notify';
import { staffAuditSchema } from '@/models/Schema';
import type { StaffAction } from '@/models/Schema';

/**
 * The staff member as the record names them: their id and, when they have one, their primary email.
 * @param user - The signed-in staff member.
 * @returns The actor for `recordStaffAction`.
 */
export function staffActor(user: {
  id: string;
  primaryEmailAddress: { emailAddress: string } | null;
}) {
  return { id: user.id, email: user.primaryEmailAddress?.emailAddress ?? null };
}

/**
 * Records that a member of staff did something. Call it in the same transaction as the change, so the record never shows
 * something that rolled back. Nothing here changes or deletes a row.
 * @param executor - The database or a transaction.
 * @param entry - What happened.
 * @param entry.actor - The staff member.
 * @param entry.action - What they did.
 * @param entry.target - What it was done to.
 * @param entry.details - Ids and short codes only, never a person's claim.
 *
 * A change made through the MCP server is recorded as the person who signed in to it, with `via: mcp` added, so the record reads as
 * that person acting through an assistant.
 */
export async function recordStaffAction(
  executor: Executor,
  entry: {
    actor: { id: string; email: string | null };
    action: StaffAction;
    target?: { type: string; id: string };
    details?: Record<string, string>;
  },
) {
  await executor.insert(staffAuditSchema).values({
    actorId: entry.actor.id,
    actorEmail: entry.actor.email,
    action: entry.action,
    targetType: entry.target?.type ?? null,
    targetId: entry.target?.id ?? null,
    details: { ...entry.details, ...(actingStaff.getStore() && { via: 'mcp' }) },
  });
}

/**
 * Lists the most recent staff actions, newest first.
 * @param limit - How many to read.
 * @returns The actions.
 */
export async function listStaffAudit(limit = 100) {
  const rows = await db
    .select()
    .from(staffAuditSchema)
    .orderBy(desc(staffAuditSchema.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    actor: row.actorEmail ?? row.actorId,
    action: row.action,
    // Whether the person acted through an assistant on the MCP server.
    via: row.details.via === 'mcp' ? ('mcp' as const) : null,
    target: row.targetType && row.targetId ? `${row.targetType} ${row.targetId.slice(0, 8)}` : null,
    at: row.createdAt.toISOString(),
  }));
}

export type StaffAuditItem = Awaited<ReturnType<typeof listStaffAudit>>[number];
