import * as z from 'zod';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { callSandwormTool } from '@/libs/sandworm/Proxy';
import { sandwormJson } from '@/libs/sandworm/Respond';

const BodyValidation = z.object({
  tool: z.string().min(1).max(100),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Calls one Sandworm tool for a staff member, using their own Sandworm login. Celia sends the call to its own workspace, refuses
 * one that carries a claimant's wallet, and records it in the staff audit with the tool's name. Only staff who pass the staff
 * area's rules may call.
 * @param request - The request, with `{ tool, arguments }` as JSON.
 * @returns Sandworm's answer, 401, 422 for a bad body, or why the call was not made.
 */
export async function POST(request: Request) {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const body = BodyValidation.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return privateJson({ problem: 'json' }, 422);
  }

  return sandwormJson(
    await callSandwormTool(caller, { tool: body.data.tool, args: body.data.arguments }),
  );
}
