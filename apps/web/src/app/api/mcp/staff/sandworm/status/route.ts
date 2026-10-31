import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { connectedSince, lastSandwormCall, sandwormSetUp } from '@/libs/sandworm/Connection';

/**
 * Whether Sandworm is set up and whether the signed-in staff member has connected it, for the MCP server. Connecting is a sign-in
 * in the browser, so it is not done here.
 * @returns Whether it is set up and when they connected and last called it, or 401.
 */
export async function GET() {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  if (!sandwormSetUp()) {
    return privateJson({ setUp: false, connectedAt: null, lastCallAt: null });
  }

  const [connectedAt, lastCallAt] = await Promise.all([
    connectedSince(caller.userId),
    lastSandwormCall(caller.userId),
  ]);

  return privateJson({
    setUp: true,
    connectedAt: connectedAt?.toISOString() ?? null,
    lastCallAt: lastCallAt?.toISOString() ?? null,
  });
}
