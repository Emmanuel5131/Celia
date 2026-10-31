import { clerkClient } from '@clerk/nextjs/server';
import * as z from 'zod';
import { runAsStaff } from '@/libs/accounts/Staff';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';
import { staffOperations } from '@/libs/mcp/StaffOperations';

const BodyValidation = z.object({
  action: z.string().min(1).max(64),
  input: z.unknown(),
  confirmed: z.boolean().optional(),
});

/**
 * Makes one change a staff member can make in the web app, for the MCP server. Without `confirmed: true` it changes nothing and
 * answers with what it would do, so the assistant has to show that to the staff member and get a yes before it asks again. With
 * it, the change runs as the signed-in staff member through the same action the web app uses, so the same rules and the same audit
 * apply, and the staff audit also records that it came from the assistant. Only staff who pass the staff area's rules may use it.
 * @param request - The request, with `{ action, input, confirmed }` as JSON.
 * @returns What it would do, what it did, 401, 404 for an action that does not exist, or 422 for input it refuses.
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

  const operation = Object.hasOwn(staffOperations, body.data.action)
    ? staffOperations[body.data.action]
    : undefined;

  if (!operation) {
    return notFound();
  }

  const prepared = await operation.prepare(body.data.input);

  if (!prepared) {
    return privateJson({ problem: 'input' }, 422);
  }

  if (body.data.confirmed !== true) {
    return privateJson({ confirmationRequired: true, summary: prepared.summary });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(caller.userId);
  const outcome = await runAsStaff(user, async () => await prepared.run());

  if (outcome.ok) {
    await recordStaffAction(db, {
      actor: { id: caller.userId, email: caller.email },
      action: 'mcp_action',
      details: { operation: body.data.action, via: 'mcp' },
    });
  }

  return privateJson({ done: outcome.ok, ...outcome });
}
