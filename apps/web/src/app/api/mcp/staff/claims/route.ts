import { listClaimsToValidate } from '@/libs/accounts/Staff';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * The sent claims waiting for staff, oldest first, for the MCP server: what kind of loss, where, how much, whether the wallet is
 * proven and why a claim may need a closer look. No name, no email, no wallet address and no proof files: those stay in the staff
 * area. Only staff who pass the staff area's rules may ask.
 * @returns The claims, or 401.
 */
export async function GET() {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const claims = await listClaimsToValidate();

  return privateJson(
    claims.map((claim) => ({
      id: claim.id,
      platformName: claim.platformName,
      fraudType: claim.fraudType,
      chain: claim.chain,
      amountLost: claim.amountLost,
      walletSigned: claim.signed,
      state: claim.state,
      signals: claim.signals,
      submittedAt: claim.submittedAt,
    })),
  );
}
