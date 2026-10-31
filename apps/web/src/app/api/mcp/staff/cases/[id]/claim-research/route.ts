import * as z from 'zod';
import { researchCaseClaims } from '@/libs/claims/ClaimResearch';
import {
  identifyMcpCallerWithRole,
  notFound,
  privateJson,
  unauthorized,
} from '@/libs/mcp/McpCaller';

/**
 * Researches all the confirmed claims of a case together, on the chain and off it, for the MCP server: where the payments landed,
 * what the receiving addresses are now, and when the platform's domain was registered and first archived. It reads the claims
 * itself, so no claimant wallet, name or statement ever reaches the assistant. Only staff who pass the staff area's rules may ask.
 * @param _request - The request.
 * @param context - The route parameters.
 * @param context.params - The case id.
 * @returns The findings, 401 or 404.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  const research = z.uuid().safeParse(id).success ? await researchCaseClaims(id) : null;

  return research ? privateJson(research) : notFound();
}
