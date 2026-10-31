import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import type { Role } from '../auth.ts';
import { registerTools } from './index.ts';

async function toolNames(role: Role) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server, {
    caller: { userId: 'user_1', role, token: 'token' },
    webUrl: 'https://app.example.org',
  });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const { tools } = await client.listTools();
  await client.close();

  return tools.map((tool) => tool.name).toSorted();
}

const caseTools = ['get_case', 'get_case_story', 'get_report', 'list_cases'];

describe(registerTools, () => {
  it('gives a person the case bank and their own claims', async () => {
    expect(await toolNames('person')).toStrictEqual(
      [...caseTools, 'get_my_claim', 'list_my_claims'].toSorted(),
    );
  });

  it('gives a lawyer the case bank and the cases their firm leads', async () => {
    expect(await toolNames('counsel')).toStrictEqual(
      [...caseTools, 'get_case_claims', 'list_my_cases'].toSorted(),
    );
  });

  it('gives staff the case bank, the review queues, plan previews, Sandworm, report saving and every change the staff area can make', async () => {
    expect(await toolNames('staff')).toStrictEqual(
      [
        ...caseTools,
        'get_analysis_brief',
        'accept_claims',
        'add_alleged_action',
        'add_alleged_actor',
        'add_evidence',
        'add_statement',
        'allow_mail',
        'approve_analysis_brief',
        'approve_application',
        'decline_wallet_proof',
        'disconnect_sandworm',
        'get_case_claim_accounts',
        'get_case_lists',
        'mark_application_ready',
        'reject_application',
        'reject_claims',
        'remove_alleged_action',
        'remove_alleged_actor',
        'remove_evidence',
        'remove_statement',
        'retry_mail',
        'review_evidence',
        'run_application_lookups',
        'set_application_check',
        'set_case_stage',
        'start_claim_reviews',
        'triage_claims',
        'update_statement',
        'update_evidence',
        'update_alleged_actor',
        'update_alleged_action',
        'get_analysis_contract',
        'get_report_format',
        'list_claims',
        'list_claims_to_review',
        'sandworm_call',
        'sandworm_list_tools',
        'save_case_report',
        'staff_overview',
        'preview_analysis_plan',
        'list_applications',
        'get_application',
        'get_mail_status',
        'get_staff_activity',
        'sandworm_status',
        'review_claims',
        'get_report_drafts',
        'review_case_report',
        'start_evidence_upload',
        'research_case_claims',
      ].toSorted(),
    );
  });
});
