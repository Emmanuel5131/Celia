import * as z from 'zod';
import { getCase } from '@/libs/cases/Cases';
import { readCaseStory } from '@/libs/cases/CaseStory';
import {
  identifyMcpCaller,
  mcpCaseAccess,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * The story of a case for the MCP server, as the case page tells it: what claimants report and how many staff have confirmed, how
 * far it reaches, and where the platform's words and the chain disagree. Counts and public findings only; no claimant is named, and
 * nothing is a finding of fraud. A caller who may not read every list gets the first statements' checks only.
 * @param _request - The request (unused).
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The story, 401, or 404.
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

  return privateJson(await readCaseStory(id, mcpCaseAccess(caller)));
}
