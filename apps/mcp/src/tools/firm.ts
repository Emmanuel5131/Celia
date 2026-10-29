import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { WebClient } from '../web.ts';
import { handle } from './shared.ts';

/**
 * The tools for a lawyer whose firm leads cases: the cases the firm leads and the claims in them. They read only what the case
 * page shows the lead firm, without names or statements, and they change nothing. A case the firm does not lead is not found.
 * @param server - The MCP server.
 * @param web - Asks the Celia web app as the caller.
 */
export function registerFirmTools(server: McpServer, web: WebClient) {
  server.registerTool(
    'list_my_cases',
    {
      description: 'List the cases your firm leads, with their stage and how many victims and confirmed victims each has.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/firm/cases')),
  );

  server.registerTool(
    'get_case_claims',
    {
      description:
        'List the claims in a case your firm leads: the kind of loss, the wallet and transaction, the amount, the country, whether the wallet is signed and whether Celia confirmed the claim. It has no names and no statements. It refuses a case your firm does not lead.',
      inputSchema: { caseId: z.uuid().describe('The case id from list_my_cases') },
    },
    handle(async ({ caseId }) => await web(`/api/mcp/firm/cases/${caseId}/claims`)),
  );
}
