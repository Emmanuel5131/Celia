import * as z from 'zod';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';
import { FindingsValidation } from '@/validations/FindingsValidation';

const notes = [
  'Run only an approved brief (get_analysis_brief). Use its template, chains, addresses and window exactly; change none of them.',
  "Fork the template notebook into Celia's workspace, once per run, and set only its parameter cells (input, dropdown and date cells) with update_cell. Never edit a test cell.",
  "Put the platform's addresses in the notebook, never a claimant's wallet, name or statement. Celia refuses a call that carries a claimant wallet.",
  'The notebook writes ./data/<case number in lower case>/run-<run>/findings.json, for example ./data/cb-0142/run-1/findings.json, with json.dump. Read it back whole with read_file (up to 256 KB a call; page with nextOffset). Read the file, not the printed output, which Sandworm clips.',
  'Each test carries its own table, a verdict from a rule fixed before the run, and a summary sentence built by the notebook from its own numbers. Do not rewrite a number or a verdict.',
  'Files in the workspace are shared by every notebook: keep the case number in every path.',
  'Never declare fraud. Say what the chain shows and what it does not. A claim the chain cannot show is not_checkable.',
];

/**
 * The contract between a template notebook and Celia: the schema of the findings file a run writes, and the rules for the run.
 * Only staff who pass the staff area's rules may ask.
 * @returns The schema and the notes, or 401.
 */
export async function GET() {
  if (!(await identifyMcpCallerWithRole('staff'))) {
    return unauthorized();
  }

  return privateJson({ findingsSchema: z.toJSONSchema(FindingsValidation), notes });
}
