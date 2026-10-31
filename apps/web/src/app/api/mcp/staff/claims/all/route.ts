import * as z from 'zod';
import { listClaimsForMcp } from '@/libs/claims/McpClaims';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

const QueryValidation = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  search: z.string().trim().max(100).optional(),
});

/**
 * Every claim in the case bank, newest first, in pages, for the MCP server, optionally only those that name a platform, person or
 * group matching a search. Each row says what kind of loss, which chain, how much, when and its state. It has no claimant's name,
 * email, wallet, transaction or proof, and no account of what happened. Only staff who pass the staff area's rules may ask.
 * @param request - The request, with optional `page` and `search`.
 * @returns The claims, the total and the page size, 401, or 422 for a bad query.
 */
export async function GET(request: Request) {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const query = QueryValidation.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!query.success) {
    return privateJson({ problem: 'query' }, 422);
  }

  return privateJson(await listClaimsForMcp({ ...query.data, withAccounts: false }));
}
