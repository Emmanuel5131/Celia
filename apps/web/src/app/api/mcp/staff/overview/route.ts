import { staffCounts } from '@/libs/accounts/StaffCounts';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * How much is waiting in each staff queue, for the MCP server. Only staff who pass the staff area's rules may ask.
 * @returns The counts, or 401.
 */
export async function GET() {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  return privateJson(await staffCounts());
}
