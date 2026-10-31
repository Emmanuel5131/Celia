import type { NextRequest } from 'next/server';
import * as z from 'zod';
import { previewBrief } from '@/libs/analysis/Analysis';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * The research plan for one statement as the staff page shows it before anyone approves it: the problems that stop it and, once
 * none is left, the brief. Nothing is saved. Only staff who pass the staff area's rules may ask.
 * @param request - The request, with `statementId` in the query.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The problems and the brief (null while anything blocks), 401, or 404.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  const statementId = z.uuid().safeParse(request.nextUrl.searchParams.get('statementId'));
  const prepared =
    z.uuid().safeParse(id).success && statementId.success
      ? await previewBrief(id, statementId.data)
      : null;

  if (!prepared) {
    return notFound();
  }

  return privateJson({ problems: prepared.problems, brief: prepared.brief });
}
