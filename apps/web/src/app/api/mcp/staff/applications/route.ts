import { listApplicationsInReview } from '@/libs/accounts/Applications';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { applicationForMcp } from '@/utils/accounts/McpApplication';

/**
 * The applications waiting for review, oldest first, for the MCP server: what the applicant gave about their organisation, the
 * checks staff have ticked and the lookups. The applicant's name and email are left out. Only staff who pass the staff area's rules
 * may ask.
 * @returns The applications in review, or 401.
 */
export async function GET() {
  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  const items = await listApplicationsInReview();

  return privateJson({ applications: items.map(applicationForMcp) });
}
