import * as z from 'zod';
import { getCase } from '@/libs/cases/Cases';
import { reviewReportByAgent } from '@/libs/cases/Reports';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

const BodyValidation = z.object({
  run: z.number().int().positive(),
  version: z.number().int().positive(),
  verdict: z.enum(['pass', 'concerns']),
  message: z.string().trim().min(1).max(2000),
});

/**
 * Records the assistant's review of a draft report, with the message it prepared for the person who decides. It moves the draft to
 * reviewed and nothing more: the report stays hidden outside the staff area until a person says yes in the staff area, and no
 * route here can say it. Only staff who pass the staff area's rules may review.
 * @param request - The request, with `{ run, version, verdict, message }` as JSON.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns `{ reviewed: true }`, 401, 404, or 422 (bad input, or no such draft waiting for review).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  if (!z.uuid().safeParse(id).success || !(await getCase(id))) {
    return notFound();
  }

  const body = BodyValidation.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return privateJson({ problem: 'input' }, 422);
  }

  const result = await reviewReportByAgent({
    caseId: id,
    ...body.data,
    actor: { id: caller.userId, email: caller.email },
  });

  return result === 'ok' ? privateJson({ reviewed: true }) : privateJson({ problem: result }, 422);
}
