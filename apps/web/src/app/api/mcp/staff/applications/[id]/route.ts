import { getApplicationDetail } from '@/libs/accounts/Applications';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';
import { applicationForMcp } from '@/utils/accounts/McpApplication';

/**
 * One application in review with the staff activity on it, for the MCP server. The applicant's name, email and phone numbers are
 * left out. Only staff who pass the staff area's rules may ask.
 * @param _request - The request (unused).
 * @param context - The route parameters.
 * @param context.params - The applicant's user id.
 * @returns The application and its history, 401, or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  const detail = await getApplicationDetail(id);

  if (!detail) {
    return notFound();
  }

  return privateJson({
    application: applicationForMcp(detail.item),
    account: {
      emailVerified: detail.account.emailVerified,
      createdAt: detail.account.createdAt,
      lastSignInAt: detail.account.lastSignInAt,
    },
    readyAt: detail.readyAt,
    history: detail.history,
  });
}
