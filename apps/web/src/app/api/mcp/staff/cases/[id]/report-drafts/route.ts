import * as z from 'zod';
import { getCase } from '@/libs/cases/Cases';
import { listReportsInReview } from '@/libs/cases/Reports';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * The reports of a case that are still in review, for the MCP server: drafts the assistant saved that wait for its review, and
 * reviewed reports that wait for a person's yes or no. Each has its findings, so the assistant can read a draft before reviewing it.
 * Only staff who pass the staff area's rules may ask.
 * @param _request - The request (unused).
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The reports in review, 401, or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  if (!z.uuid().safeParse(id).success || !(await getCase(id))) {
    return notFound();
  }

  const reports = await listReportsInReview(id);

  return privateJson({
    reports: reports.map((report) => ({
      run: report.run,
      version: report.version,
      review: report.review,
      hash: report.hash,
      savedAt: report.savedAt,
      agentReview: report.agentReview,
      report: report.snapshot,
    })),
  });
}
