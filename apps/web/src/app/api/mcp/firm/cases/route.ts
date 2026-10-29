import { listCasesLedBy } from '@/libs/cases/Cases';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * The cases a lawyer's firm leads, for the MCP server. Only counsel lead cases, so only counsel may ask.
 * @returns The cases, or 401.
 */
export async function GET() {
  const caller = await identifyMcpCallerWithRole('counsel');

  if (!caller) {
    return unauthorized();
  }

  return privateJson(await listCasesLedBy(caller.userId));
}
