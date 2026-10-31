import * as z from 'zod';
import { listEvidence } from '@/libs/analysis/Evidence';
import { listResearch } from '@/libs/analysis/Research';
import { listActions } from '@/libs/cases/Actions';
import { getCase } from '@/libs/cases/Cases';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';
import { actionRows } from '@/utils/cases/Actions';

/**
 * The lists staff keep on a case, for the MCP server, with the ids a change needs: the alleged actions with how much evidence backs
 * each, the evidence, the alleged actors by their place in the list, and the statements with where their research stands. Public
 * facts and staff's own notes only; there is nothing about any claimant. Only staff who pass the staff area's rules may ask.
 * @param _request - The request.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The lists, 401 or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    return notFound();
  }

  const [evidence, actions, research] = await Promise.all([
    listEvidence(found.id),
    listActions(found.id),
    listResearch(found.id, { inReview: true }),
  ]);

  return privateJson({
    case: { id: found.id, name: found.name, stage: found.status },
    actions: actionRows(actions, evidence),
    evidence: evidence.map((item) => ({
      id: item.id,
      type: item.type,
      source: item.source,
      title: item.title,
      reviewState: item.source === 'off_chain' ? item.reviewState : null,
      sourceUrl: item.sourceUrl,
      actionId: item.actionId,
      statementId: item.statementId,
    })),
    actors: found.operators.map((operator, index) => ({ index, ...operator })),
    statements: research.map((item) => ({
      id: item.statement.id,
      text: item.statement.text,
      kind: item.statement.kind,
      research: item.state,
    })),
  });
}
