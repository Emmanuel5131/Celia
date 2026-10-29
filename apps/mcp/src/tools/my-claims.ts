import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { WebClient } from '../web.ts';
import { handle } from './shared.ts';

/**
 * The tools for a person who reported a loss: their own claims and where each one stands. They read only the caller's own claims,
 * and nobody else's, and they change nothing.
 * @param server - The MCP server.
 * @param web - Asks the Celia web app as the caller.
 */
export function registerMyClaimTools(server: McpServer, web: WebClient) {
  server.registerTool(
    'list_my_claims',
    {
      description:
        'List your own claims with where each stands: draft, sent, in review, accepted or rejected. Only your own claims, never anyone else’s.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/my/claims')),
  );

  server.registerTool(
    'get_my_claim',
    {
      description:
        'Read one of your own claims: the platform, the kind of loss, the amount, whether your wallet is proven and where the claim stands.',
      inputSchema: { claimId: z.uuid().describe('The claim id from list_my_claims') },
    },
    handle(async ({ claimId }) => await web(`/api/mcp/my/claims/${claimId}`)),
  );
}
