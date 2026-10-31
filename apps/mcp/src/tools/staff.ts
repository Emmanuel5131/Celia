import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { WebClient } from '../web.ts';
import { handle } from './shared.ts';

/**
 * The tools for Celia staff: what is waiting in the review queues, research on Sandworm, and saving a case's research report. The
 * queues are the same counts and claims as the staff area, without any name, email, wallet address or proof file. The tools that
 * write are `sandworm_call` and `save_case_report`, which the web app holds to the staff area's rules and records in the staff
 * audit.
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
    'get_report_format',
    {
      description:
        'The format a case report must have, as a JSON schema, with the rules the checks add. Read it before turning an analysis, such as a published Sandworm notebook, into findings for save_case_report.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/report-format')),
  );

  server.registerTool(
    'get_analysis_brief',
    {
      description:
        'The analysis brief a staff member approved for a case: the template, chains, the platform\'s addresses, the window, the statements to test and the budget, with its run number and commitment. Run exactly this and nothing else. If none is approved it says what blocks one; tell the staff member, and do not start an analysis. Approving is a person\'s step in the staff area.',
      inputSchema: { caseId: z.uuid().describe('The case id from list_cases') },
    },
    handle(async ({ caseId }) => await web(`/api/mcp/staff/cases/${caseId}/analysis-brief`)),
  );

  server.registerTool(
    'get_analysis_contract',
    {
      description:
        'The contract for an analysis run: the JSON schema of the findings file the template notebook writes, and the rules for the run (fork the template, set only its parameter cells, write and read the findings file, never put a claimant wallet in a notebook). Read it before running an approved brief.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/analysis-contract')),
  );

  server.registerTool(
    'sandworm_list_tools',
    {
      description:
        "List the tools of the Sandworm MCP (notebooks, runs, results and so on) with their inputs. They run as the signed-in staff member in Celia's Sandworm workspace. If it says the staff member has not connected Sandworm, tell them to open Staff, Sandworm in Celia and press Connect Sandworm.",
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/sandworm/tools')),
  );

  server.registerTool(
    'sandworm_call',
    {
      description:
        "Call one Sandworm tool (named by sandworm_list_tools) as the signed-in staff member. Celia sends it to its own workspace, so leave workspaceId out. This can create notebooks and start runs, and Sandworm keeps the arguments and results in the notebook's chat; an attested notebook is public for good. So put public facts only in it: the platform's addresses, never a claimant's name, wallet or statement. Celia refuses a call that carries a claimant's wallet, and records every call in the staff audit.",
      inputSchema: {
        tool: z.string().describe('The Sandworm tool name from sandworm_list_tools'),
        arguments: z
          .record(z.string(), z.unknown())
          .default({})
          .describe("The tool's arguments, as sandworm_list_tools describes them"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handle(async ({ tool, arguments: args }) => await web('/api/mcp/staff/sandworm/call', { body: { tool, arguments: args } })),
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
