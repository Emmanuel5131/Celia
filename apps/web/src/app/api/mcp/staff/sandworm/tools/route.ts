import { identifyMcpCallerWithRole, unauthorized } from '@/libs/mcp/McpCaller';
import { listSandwormTools } from '@/libs/sandworm/Proxy';
import { sandwormJson } from '@/libs/sandworm/Respond';

/**
 * Lists the tools of the Sandworm MCP for a staff member, using their own Sandworm login. Only staff who pass the staff area's
 * rules may ask.
 * @returns The tools, 401, or why Sandworm could not be asked.
 */
export async function GET() {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  return sandwormJson(await listSandwormTools(caller));
}
