import { and, eq, inArray, sql } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { getAccessToken, sandwormSetUp } from '@/libs/sandworm/Connection';
import { sandwormRequest } from '@/libs/sandworm/Sandworm';
import { claimAddressSchema, claimSchema } from '@/models/Schema';
import { addressCandidates } from '@/utils/sandworm/WalletScan';

type Caller = { userId: string; email: string | null };

/** What came of a call to Sandworm: its answer, or why Celia did not make it. */
export type SandwormOutcome =
  | { status: 'ok'; result: unknown }
  | { status: 'not_set_up' }
  | { status: 'not_connected' }
  | { status: 'claimant_wallet' };

/**
 * Tells whether any word in a tool call is the wallet of someone who filed a claim. A notebook is saved with its chat and an
 * attested one is public for good, so a claimant's wallet must never reach Sandworm. The platform's own addresses are fine.
 * @param args - The arguments of the tool call.
 * @returns True when a claimant's wallet is in them.
 */
async function holdsClaimantWallet(args: unknown) {
  const candidates = addressCandidates(args);

  if (candidates.length === 0) {
    return false;
  }

  const [claims, affected] = await Promise.all([
    db
      .select({ id: claimSchema.id })
      .from(claimSchema)
      .where(inArray(sql`lower(${claimSchema.walletAddress})`, candidates))
      .limit(1),
    db
      .select({ id: claimAddressSchema.id })
      .from(claimAddressSchema)
      .where(
        and(
          eq(claimAddressSchema.role, 'affected'),
          inArray(sql`lower(${claimAddressSchema.address})`, candidates),
        ),
      )
      .limit(1),
  ]);

  return claims.length > 0 || affected.length > 0;
}

/**
 * Asks Sandworm as the staff member, with their own access token. A token Sandworm no longer accepts is refreshed once.
 * @param userId - The staff member's Clerk user id.
 * @param method - The MCP method.
 * @param params - Its parameters.
 * @returns The answer, or `not_connected` when the person has to sign in to Sandworm again.
 */
async function ask(
  userId: string,
  method: 'tools/list' | 'tools/call',
  params: Record<string, unknown>,
): Promise<SandwormOutcome> {
  if (!sandwormSetUp() || !Env.SANDWORM_WORKSPACE_ID) {
    return { status: 'not_set_up' };
  }

  const token = await getAccessToken(userId);

  if (!token) {
    return { status: 'not_connected' };
  }

  let reply = await sandwormRequest(token, method, params);

  if (reply.status === 'unauthorized') {
    const fresh = await getAccessToken(userId, { fresh: true });

    if (!fresh) {
      return { status: 'not_connected' };
    }

    reply = await sandwormRequest(fresh, method, params);
  }

  if (reply.status === 'unauthorized') {
    throw new Error('Sandworm did not accept a fresh token');
  }

  return { status: 'ok', result: reply.result };
}

/**
 * Lists the tools the Sandworm MCP offers this staff member.
 * @param caller - The staff member, who must already have passed the staff rules.
 * @returns The tools, or why they could not be listed.
 */
export async function listSandwormTools(caller: Caller) {
  return await ask(caller.userId, 'tools/list', {});
}

/**
 * Calls one Sandworm tool as the staff member. Celia sets the workspace itself, so a call never lands in a personal workspace;
 * refuses a call that carries a claimant's wallet; and writes the call to the staff audit before making it. The audit holds the
 * tool name only, never the arguments.
 * @param caller - The staff member, who must already have passed the staff rules.
 * @param request - The call.
 * @param request.tool - The Sandworm tool.
 * @param request.args - Its arguments.
 * @returns Sandworm's answer, or why Celia did not make the call.
 */
export async function callSandwormTool(
  caller: Caller,
  request: { tool: string; args: Record<string, unknown> },
) {
  if (!sandwormSetUp() || !Env.SANDWORM_WORKSPACE_ID) {
    return { status: 'not_set_up' } as const satisfies SandwormOutcome;
  }

  const refused = await holdsClaimantWallet(request.args);

  await recordStaffAction(db, {
    actor: { id: caller.userId, email: caller.email },
    action: 'sandworm_called',
    target: { type: 'sandworm_tool', id: request.tool },
    details: { via: 'mcp', ...(refused && { refused: 'claimant_wallet' }) },
  });

  if (refused) {
    return { status: 'claimant_wallet' } as const satisfies SandwormOutcome;
  }

  return await ask(caller.userId, 'tools/call', {
    name: request.tool,
    arguments: { ...request.args, workspaceId: Env.SANDWORM_WORKSPACE_ID },
  });
}
