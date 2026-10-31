import * as z from 'zod';
import { listResearch } from '@/libs/analysis/Research';
import { getCase } from '@/libs/cases/Cases';
import {
  identifyMcpCaller,
  mcpCaseAccess,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';
import { previewRows } from '@/utils/cases/Preview';
import { shareReport } from '@/utils/cases/ReportShare';

/**
 * The research of a case for the MCP server: one entry for each statement the platform made, with where its research stands and,
 * once it has one, its newest report: the finding, what is proven and what is not, the tests behind it, and the hash and time it
 * was saved. A report names no victim, and nobody's plan, approver or review note is shown.
 * @param _request - The request (unused).
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The statements with their reports, 401, or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const caller = await identifyMcpCaller();

  if (!caller) {
    return unauthorized();
  }

  if (!z.uuid().safeParse(id).success || !(await getCase(id))) {
    return notFound();
  }

  // Someone who may not read every list gets the first statements only, as on the case page.
  const all = await listResearch(id);
  const items = mcpCaseAccess(caller) === 'full' ? all : all.slice(0, previewRows);

  return privateJson({
    statements: items.map((item) => ({
      statement: {
        text: item.statement.text,
        kind: item.statement.kind,
        sourceUrl: item.statement.sourceUrl,
      },
      state: item.state,
      run: item.plan?.run ?? null,
      report: item.report && shareReport(item.report),
    })),
  });
}
