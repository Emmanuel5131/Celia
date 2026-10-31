import * as z from 'zod';
import { getCase } from '@/libs/cases/Cases';
import { listClaimsForMcp } from '@/libs/claims/McpClaims';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

const PageValidation = z.coerce.number().int().min(1).max(1000).default(1);

/**
 * The claims pooled into one case, in pages, with each claimant's own account of what happened, for the MCP server, so the
 * assistant can work out what the claimants allege was done and propose alleged actions. The accounts are free text and can hold a
 * name or a wallet, so the assistant must write actions in general words and copy neither. There is no claimant id, name, email,
 * wallet, transaction or proof. Only staff who pass the staff area's rules may ask.
 * @param request - The request, with an optional `page`.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The case's claims, 401, 404 or 422.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    return notFound();
  }

  const page = PageValidation.safeParse(new URL(request.url).searchParams.get('page') ?? undefined);

  if (!page.success) {
    return privateJson({ problem: 'query' }, 422);
  }

  return privateJson({
    case: { id: found.id, name: found.name, stage: found.status },
    ...(await listClaimsForMcp({
      platformKey: found.platformKey,
      page: page.data,
      withAccounts: true,
    })),
  });
}
