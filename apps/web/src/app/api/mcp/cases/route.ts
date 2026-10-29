import { listCases } from '@/libs/cases/Cases';
import { identifyMcpCaller, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * The case bank for the MCP server: every case with its stage and counts. A summary only, as in the case bank itself, so nobody's
 * claim is in it.
 * @returns The cases, or 401.
 */
export async function GET() {
  if (!(await identifyMcpCaller())) {
    return unauthorized();
  }

  return privateJson(await listCases());
}
