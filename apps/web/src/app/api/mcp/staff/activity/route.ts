import { listStaffAudit } from '@/libs/accounts/StaffAudit';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * The latest staff activity for the MCP server, newest first, as the staff area's activity page shows it. Only staff who pass the
 * staff area's rules may ask.
 * @returns The audit entries, or 401.
 */
export async function GET() {
  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  return privateJson({ activity: await listStaffAudit() });
}
