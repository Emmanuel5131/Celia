import * as z from 'zod';
import { canViewCaseClaims, listCaseClaims } from '@/libs/cases/CaseClaims';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * The claims in a case the caller's firm leads, for the MCP server: what the case page shows the lead firm, without the names and
 * without any statement. A case the firm does not lead looks like one that does not exist.
 * @param _request - The request (unused).
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The claims, 401, or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await identifyMcpCallerWithRole('counsel');

  if (!caller) {
    return unauthorized();
  }

  // Counsel are never treated as staff here: the lead firm sees its own case's claims and nothing else.
  if (
    !z.uuid().safeParse(id).success ||
    !(await canViewCaseClaims({ userId: caller.userId, staff: false }, id))
  ) {
    return notFound();
  }

  const claims = await listCaseClaims(id);

  return privateJson(
    claims.map((claim) => ({
      id: claim.id,
      fraudType: claim.fraudType,
      chain: claim.chain,
      walletAddress: claim.walletAddress,
      txHash: claim.txHash,
      amountLost: claim.amountLost,
      country: claim.country,
      walletSigned: claim.ownership === 'signed',
      confirmed: claim.validatedAt !== null,
      submittedAt: claim.submittedAt?.toISOString() ?? null,
    })),
  );
}
