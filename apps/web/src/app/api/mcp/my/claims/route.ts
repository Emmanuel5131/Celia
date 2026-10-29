import { toClaimRow } from '@/components/claims/claim-row';
import { listClaims } from '@/libs/claims/Claims';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * A person's own claims for the MCP server, as the claims table shows them: no statement, nonce or signature. Only a person has
 * claims, so only a person may ask.
 * @returns The caller's claims, or 401.
 */
export async function GET() {
  const caller = await identifyMcpCallerWithRole('person');

  if (!caller) {
    return unauthorized();
  }

  const claims = await listClaims(caller.userId);

  return privateJson(claims.map(toClaimRow));
}
