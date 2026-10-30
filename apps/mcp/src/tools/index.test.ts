import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import type { Role } from '../auth.ts';
import { registerTools } from './index.ts';

async function toolNames(role: Role) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server, { caller: { userId: 'user_1', role, token: 'token' }, webUrl: 'https://app.example.org' });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const { tools } = await client.listTools();
  await client.close();

  return tools.map((tool) => tool.name).toSorted();
}

const caseTools = ['get_case', 'get_report', 'list_cases'];

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

  it('gives staff the case bank, the review queues, Sandworm and report saving', async () => {
    expect(await toolNames('staff')).toStrictEqual(
      [
        ...caseTools,
        'get_report_format',
        'list_claims_to_review',
        'sandworm_call',
        'sandworm_list_tools',
        'save_case_report',
        'staff_overview',
      ].toSorted(),
    );
  });
});
