import type { NextRequest } from 'next/server';
import * as z from 'zod';
import { listResearch } from '@/libs/analysis/Research';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * The analysis briefs the assistant may run for a case: each approved plan that has no report yet, one for each statement of the
 * platform, with the statement, its run number and its commitment. Each statement is researched on its own, so with several plans
 * waiting the assistant asks the staff member which to run, or is given `run` in the query. Without an approved plan it says so, so
 * the assistant can tell the staff member. Approving is a person's step in the staff area; no route here approves anything. Only
 * staff who pass the staff area's rules may ask.
 * @param request - The request, with an optional `run` in the query.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The plans waiting for a report, 401, or 404.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const run = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(request.nextUrl.searchParams.get('run') ?? undefined);
  const research = await listResearch(id, { inReview: true });
  const waiting = research.flatMap((item) =>
    item.state === 'researching' && item.plan && (!run.success || item.plan.run === run.data)
      ? [{ statement: item.statement, approved: item.plan }]
      : [],
  );

  return privateJson({
    waiting,
    ...(waiting.length === 0 && {
      fix: 'No approved plan is waiting for a report for this case. Do not start an analysis. Ask a staff member to open Staff, Cases, open a statement and approve its plan.',
    }),
    ...(waiting.length > 1 &&
      !run.success && {
        choose:
          'More than one plan is waiting. Each statement has its own report and notebook: ask the staff member which run to do, then ask again with that run.',
      }),
  });
}
