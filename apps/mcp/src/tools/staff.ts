import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { WebClient } from '../web.ts';
import { handle } from './shared.ts';

/**
 * The tools for Celia staff: what is waiting in the review queues, and saving a case's research report. The queues are the same
 * counts and claims as the staff area, without any name, email, wallet address or proof file. The one tool that writes is
 * `save_case_report`, which the web app holds to the staff area's rules and records in the staff audit.
 * @param server - The MCP server.
 * @param web - Asks the Celia web app as the caller.
 */
export function registerStaffTools(server: McpServer, web: WebClient) {
  server.registerTool(
    'staff_overview',
    {
      description: 'How many applications, claims and failed emails are waiting for the Celia team.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/overview')),
  );

  server.registerTool(
    'list_claims_to_review',
    {
      description:
        'List the sent claims waiting for staff, oldest first: the platform, the kind of loss, the chain, the amount, whether the wallet is proven, and the reasons a claim may need a closer look. It has no names, emails, wallet addresses or proof files.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/claims')),
  );

  server.registerTool(
    'save_case_report',
    {
      description:
        'Save the findings of an analysis as a new version of a case report. This WRITES, and lawyers see the report once it is saved, so show the findings to the staff member and save only after they approve them. Earlier versions are kept. Read the current shape with get_report. Public facts only: counts, the platform\'s addresses and what the tests found, never a claimant\'s name, wallet or statement. Every test needs a table (columns and rows), and the estimate needs a loss in dollars. Never declare fraud: say what the chain shows and what it does not. If Celia refuses the report it says what to fix.',
      inputSchema: {
        caseId: z.uuid().describe('The case id from list_cases'),
        report: z
          .record(z.string(), z.unknown())
          .describe(
            'The findings as JSON in the report format: version 1, headline, figures, checks (claim, evidence, result, tests, proof), tests (id, title, summary, columns, rows), method (commitment, notebookUrl), dataAsOf and sources',
          ),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handle(async ({ caseId, report }) => await web(`/api/mcp/staff/cases/${caseId}/report`, { body: { report } })),
  );
}
