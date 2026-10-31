import * as z from 'zod';
import { listApprovedBriefs, previewBrief } from '@/libs/analysis/Analysis';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * The analysis brief the assistant may run for a case: the newest one a staff member approved, with its run number and its
 * commitment. Without an approved brief it says what stops one, so the assistant can tell the staff member. Approving is a person's
 * step in the staff area; no route here approves anything. Only staff who pass the staff area's rules may ask.
 * @param _request - The request.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The approved brief or why there is none, 401, or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  if (!z.uuid().safeParse(id).success) {
    return notFound();
  }

  const prepared = await previewBrief(id);

  if (!prepared) {
    return notFound();
  }

  const [latest] = await listApprovedBriefs(id);

  return privateJson({
    approved: latest ?? null,
    problems: prepared.problems,
    ...(!latest && {
      fix: 'No brief is approved for this case. Do not start an analysis. Ask a staff member to open Staff, Cases, Open brief in Celia and approve it. The problems list says what still blocks it.',
    }),
  });
}
