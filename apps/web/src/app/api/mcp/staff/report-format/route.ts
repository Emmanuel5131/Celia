import * as z from 'zod';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { NewReportValidation } from '@/validations/ReportValidation';

const notes = [
  "Public facts only: counts, the platform's addresses and what the tests found. Never a claimant's name, wallet or statement.",
  'Say what the chain shows and what it does not. Never declare fraud, and avoid the words the checks refuse.',
  "Every test needs a table: columns and at least one row, up to 8 columns and 50 rows. A table from a notebook becomes a test's columns and rows.",
  'estimate.lossUsd is whole US dollars. It decides when a case starts building evidence.',
  "Link the published notebook in method.notebookUrl (https). Use the attestation's input hash as method.commitment when the notebook has one.",
];

/**
 * The report format for the MCP server, so an assistant can turn an analysis (for example a Sandworm notebook) into findings
 * Celia accepts: the JSON schema of a new report and the rules the checks add. Only staff who pass the staff area's rules may ask.
 * @returns The schema and the notes, or 401.
 */
export async function GET() {
  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  return privateJson({ schema: z.toJSONSchema(NewReportValidation), notes });
}
