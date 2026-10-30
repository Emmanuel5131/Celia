import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { refreshTokens } from '@/libs/sandworm/Sandworm';
import type { SandwormTokens } from '@/libs/sandworm/Sandworm';
import { sandwormConnectionSchema, staffAuditSchema } from '@/models/Schema';
import { seal, unseal } from '@/utils/Seal';

/**
 * Tells whether staff can connect Sandworm at all: Celia has a client id there and a key to seal logins with.
 * @returns True when both are set.
 */
export function sandwormSetUp() {
  return Boolean(Env.SANDWORM_CLIENT_ID && Env.SANDWORM_TOKEN_KEY);
}

function tokenKey() {
  if (!Env.SANDWORM_TOKEN_KEY) {
    throw new Error('SANDWORM_TOKEN_KEY is not set');
  }

  return Env.SANDWORM_TOKEN_KEY;
}

function sealedTokens(tokens: SandwormTokens) {
  const key = tokenKey();

  return {
    refreshToken: seal(tokens.refresh_token, key),
    accessToken: seal(tokens.access_token, key),
    accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
}

/**
 * Keeps the tokens of a staff member who just signed in to Sandworm, sealed. A second sign-in replaces the first.
 * @param userId - The staff member's Clerk user id.
 * @param tokens - What Sandworm gave back.
 */
export async function saveConnection(userId: string, tokens: SandwormTokens) {
  const values = sealedTokens(tokens);

  await db
    .insert(sandwormConnectionSchema)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: sandwormConnectionSchema.userId, set: values });
}

/**
 * Forgets a staff member's Sandworm login. Sandworm cannot revoke it, but without it Celia can no longer use it, and it expires.
 * @param userId - The staff member's Clerk user id.
 */
export async function deleteConnection(userId: string) {
  await db.delete(sandwormConnectionSchema).where(eq(sandwormConnectionSchema.userId, userId));
}

/**
 * Reads when a staff member connected Sandworm.
 * @param userId - The staff member's Clerk user id.
 * @returns The time, or null when they are not connected.
 */
export async function connectedSince(userId: string) {
  const [row] = await db
    .select({ connectedAt: sandwormConnectionSchema.connectedAt })
    .from(sandwormConnectionSchema)
    .where(eq(sandwormConnectionSchema.userId, userId));

  return row?.connectedAt ?? null;
}

/**
 * Reads when a staff member last made a Sandworm call that Celia sent on. A call Celia refused is not counted.
 * @param userId - The staff member's Clerk user id.
 * @returns The time, or null when they have made none.
 */
export async function lastSandwormCall(userId: string) {
  const [row] = await db
    .select({ at: staffAuditSchema.createdAt })
    .from(staffAuditSchema)
    .where(
      and(
        eq(staffAuditSchema.actorId, userId),
        eq(staffAuditSchema.action, 'sandworm_called'),
        sql`${staffAuditSchema.details}->>'refused' is null`,
      ),
    )
    .orderBy(desc(staffAuditSchema.createdAt))
    .limit(1);

  return row?.at ?? null;
}

/**
 * Gives a staff member's Sandworm access token, refreshing it when it has run out. Sandworm makes every refresh token single-use,
 * so the row is locked while one refresh runs: a second call at the same moment waits and then finds the new token instead of
 * spending the old one and losing the connection. A login that Sandworm no longer accepts is deleted.
 * @param userId - The staff member's Clerk user id.
 * @param options - How to read it.
 * @param options.fresh - Refresh even if the saved token has not run out, for a token Sandworm said it no longer accepts.
 * @returns The access token, or null when they are not connected or must sign in again.
 */
export async function getAccessToken(userId: string, options?: { fresh?: boolean }) {
  const key = tokenKey();

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(sandwormConnectionSchema)
      .where(eq(sandwormConnectionSchema.userId, userId))
      .for('update');

    if (!row) {
      return null;
    }

    const stillGood = row.accessExpiresAt && row.accessExpiresAt.getTime() > Date.now() + 60_000;
    const saved = row.accessToken && stillGood ? unseal(row.accessToken, key) : null;

    if (saved && !options?.fresh) {
      return saved;
    }

    const refreshToken = unseal(row.refreshToken, key);
    const tokens = refreshToken ? await refreshTokens(refreshToken) : null;

    if (!tokens) {
      await tx.delete(sandwormConnectionSchema).where(eq(sandwormConnectionSchema.userId, userId));

      return null;
    }

    await tx
      .update(sandwormConnectionSchema)
      .set(sealedTokens(tokens))
      .where(eq(sandwormConnectionSchema.userId, userId));

    return tokens.access_token;
  });
}
