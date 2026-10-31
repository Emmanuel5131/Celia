import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { mailStatus } from '@/libs/notifications/MailStatus';

/**
 * The state of the mail queue for the MCP server: what waits, the latest failures and the addresses we stopped mailing. Only staff
 * who pass the staff area's rules may ask.
 * @returns The queue counts, failures and suppressed addresses, or 401.
 */
export async function GET() {
  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  return privateJson(await mailStatus());
}
