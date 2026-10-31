import * as z from 'zod';
import { listAllClaimsToValidate } from '@/libs/accounts/Staff';
import { listAgentReviews } from '@/libs/claims/AgentReview';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { claimantLabel } from '@/utils/claims/ClaimResearch';

/** How many claims a page holds: as many as `review_claims` takes in one call, so a page is reviewed in one go. */
const pageSize = 50;

const QueryValidation = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  unreviewed: z.enum(['true', 'false']).default('false'),
});

/**
 * The sent claims waiting for staff, oldest first, in pages, for the MCP server: what kind of loss, where, how much, whether the
 * wallet is proven and why a claim may need a closer look. It also counts the whole queue (waiting, reviewed, flagged), so the
 * assistant and staff can see how far a review has got. With `unreviewed=true` only the claims with no review of the assistant
 * are listed; as each page is reviewed those drop out, so the next page to ask for is page 1 again. No name, no email, no wallet
 * address and no proof files: those stay in the staff area. Only staff who pass the staff area's rules may ask.
 * @param request - The request, with an optional `page` and `unreviewed`.
 * @returns The queue's counts and one page of claims, 401 or 422.
 */
export async function GET(request: Request) {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const query = QueryValidation.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!query.success) {
    return privateJson({ problem: 'query' }, 422);
  }

  const claims = await listAllClaimsToValidate();
  const reviews = await listAgentReviews(claims.map((claim) => claim.id));
  const listed = claims
    .map((claim) => ({
      id: claim.id,
      claimant: claimantLabel(claim.id),
      platformName: claim.platformName,
      fraudType: claim.fraudType,
      chain: claim.chain,
      amountLost: claim.amountLost,
      walletSigned: claim.signed,
      // How much the person added to show it, counted only: staff open the files and the video themselves.
      evidence: { files: claim.proof?.files.length ?? 0, video: Boolean(claim.proof?.videoUrl) },
      state: claim.state,
      signals: claim.signals,
      submittedAt: claim.submittedAt,
      agentReview: reviews.get(claim.id) ?? null,
    }))
    .filter((claim) => query.data.unreviewed === 'false' || claim.agentReview === null);
  const start = (query.data.page - 1) * pageSize;

  return privateJson({
    waiting: claims.length,
    reviewed: reviews.size,
    flagged: [...reviews.values()].filter((review) => review.interesting).length,
    listed: listed.length,
    page: query.data.page,
    pageSize,
    claims: listed.slice(start, start + pageSize),
  });
}
