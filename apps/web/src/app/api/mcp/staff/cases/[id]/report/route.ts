import * as z from 'zod';
import { getCase } from '@/libs/cases/Cases';
import { saveCheckedReport } from '@/libs/cases/Reports';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

const BodyValidation = z.object({ report: z.unknown() });

/**
 * Saves a new version of a case's report for the MCP server. The findings are held to the same rules as in the staff area (the
 * report format, the house language, a table for every test and a loss that can be read), and the save is written to the staff
 * audit with where it came from. Only staff who pass the staff area's rules may save one.
 * @param request - The request, with `{ report }` as JSON.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns `{ saved: true }`, 401, 404, or 422 with the problem to fix.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const body = BodyValidation.safeParse(await request.json().catch(() => null));

  if (!z.uuid().safeParse(id).success || !(await getCase(id))) {
    return notFound();
  }

  if (!body.success) {
    return privateJson({ problem: 'json' }, 422);
  }

  const problem = await saveCheckedReport({
    caseId: id,
    json: body.data.report,
    actor: { id: caller.userId, email: caller.email },
    via: 'mcp',
  });

  return problem ? privateJson({ problem }, 422) : privateJson({ saved: true });
}
