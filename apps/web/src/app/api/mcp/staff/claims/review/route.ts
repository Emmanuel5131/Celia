import * as z from 'zod';
import { saveAgentReviews } from '@/libs/claims/AgentReview';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

const BodyValidation = z.object({
  reviews: z
    .array(
      z.object({
        claimId: z.uuid(),
        interesting: z.boolean(),
        message: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Records the assistant's review of sent claims for the MCP server: for each, whether it is worth a closer look and the message it
 * prepared for staff. Claims it flags appear on their own tab in the staff area. It changes nothing about a claim: only staff
 * accept or reject. Only staff who pass the staff area's rules may review.
 * @param request - The request, with `{ reviews }` as JSON.
 * @returns How many claims were reviewed and how many skipped, 401, or 422.
 */
export async function POST(request: Request) {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const body = BodyValidation.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return privateJson({ problem: 'input' }, 422);
  }

  return privateJson(
    await saveAgentReviews({
      reviews: body.data.reviews,
      actor: { id: caller.userId, email: caller.email },
    }),
  );
}
