import * as z from 'zod';
import { toClaimRow } from '@/components/claims/claim-row';
import { getClaim } from '@/libs/claims/Claims';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * One of a person's own claims for the MCP server. Asking for someone else's claim finds nothing.
 * @param _request - The request (unused).
 * @param context - The route parameters.
 * @param context.params - The claim id.
 * @returns The claim, 401, or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await identifyMcpCallerWithRole('person');

  if (!caller) {
    return unauthorized();
  }

  const claim = z.uuid().safeParse(id).success ? await getClaim(caller.userId, id) : undefined;

  return claim ? privateJson(toClaimRow(claim)) : notFound();
}
