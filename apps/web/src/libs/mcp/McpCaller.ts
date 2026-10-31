import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { staffDecision } from '@/libs/accounts/Staff';
import { parseAccount } from '@/utils/accounts/Account';
import { caseAccess } from '@/utils/accounts/CaseAccess';

/** What a caller of the MCP server is on Celia. */
export type McpRole = 'staff' | 'counsel' | 'person';

/**
 * Finds who is calling the MCP routes from the OAuth token the assistant signed in with. Clerk checks the token; the role comes
 * from the person's account, and staff must pass the same rules as the staff area, so the MCP server is never a way round them.
 * Someone who has not finished onboarding has no role, because a missing account never defaults to one.
 * @returns The caller, or null when the token is missing, wrong or belongs to someone with no role.
 */
export async function identifyMcpCaller() {
  const state = await auth({ acceptsToken: 'oauth_token' });

  if (!state.isAuthenticated || !state.userId) {
    return null;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(state.userId);

  const email = user.primaryEmailAddress?.emailAddress ?? null;

  if (staffDecision(user) === 'allowed') {
    return { userId: user.id, email, role: 'staff' as const, review: null };
  }

  const account = parseAccount(user.publicMetadata);

  return account
    ? { userId: user.id, email, role: account.accountType, review: account.review ?? null }
    : null;
}

/**
 * Finds who is calling and lets them through only with one of the roles a route is for. A route for one kind of person is never
 * reachable by another, whatever tools the MCP server shows.
 * @param roles - The roles the route is for.
 * @returns The caller, or null when there is no good token or the role is not one of these.
 */
export async function identifyMcpCallerWithRole(...roles: McpRole[]) {
  const caller = await identifyMcpCaller();

  return caller && roles.includes(caller.role) ? caller : null;
}

/**
 * How much of a case this caller may read. Staff and verified organisations read every list; everyone else gets the first rows of
 * each, as in the web app, so the MCP server is never a way round the limit.
 * @param caller - Who is calling, from `identifyMcpCaller`.
 * @returns The access.
 */
export function mcpCaseAccess(caller: NonNullable<Awaited<ReturnType<typeof identifyMcpCaller>>>) {
  return caseAccess({
    account:
      caller.role === 'staff'
        ? null
        : { accountType: caller.role, review: caller.review ?? undefined },
    staff: caller.role === 'staff',
  });
}

/**
 * The answer for a call with no good token. Every MCP route gives the same one.
 * @returns A 401 response.
 */
export function unauthorized() {
  return new NextResponse('Unauthorized', { status: 401 });
}

/**
 * The answer for a call that found nothing, or nothing the caller may see.
 * @returns A 404 response.
 */
export function notFound() {
  return new NextResponse('Not found', { status: 404 });
}

/**
 * JSON for the MCP server that no cache may keep, because it is for one signed-in caller.
 * @param data - What to send.
 * @param status - The HTTP status, 200 unless said.
 * @returns The response.
 */
export function privateJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
