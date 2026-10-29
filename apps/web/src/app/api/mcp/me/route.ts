import { identifyMcpCaller, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

/**
 * Tells the MCP server who is calling and what role they have. It is how the server learns a token is good without holding any
 * Clerk secret. The route is under `/api/mcp`, which the proxy runs Clerk on without protecting, so it checks for itself.
 * @returns The user id and role, or 401.
 */
export async function GET() {
  const caller = await identifyMcpCaller();

  return caller ? privateJson(caller) : unauthorized();
}
