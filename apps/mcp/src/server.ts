import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Authenticator } from './auth.ts';
import { registerTools } from './tools/index.ts';

const maxBodyBytes = 1_000_000;

export type ServerDeps = {
  authenticate: Authenticator;
  publicUrl: string;
  authServerUrl: string;
  webUrl: string;
};

const instructions =
  'Celia is a case bank: it stores what happened, who is alleged to have run a platform and what the chain shows. It does not declare fraud, because a court decides intent, and it holds no funds. Say what is proven and what is not proven, and call anything about people alleged.';

// Staff do the research on Sandworm. The web app signs in to Sandworm as the staff member (they press Connect Sandworm in the staff
// area once), so this server reaches it through sandworm_list_tools and sandworm_call, which add Celia's workspace, refuse
// claimants' wallets and write the staff audit. A Sandworm MCP connected beside this one still works but has none of those checks.
const staffInstructions =
  'For research, start from get_analysis_brief: run only a brief a staff member approved, and follow get_analysis_contract. Use sandworm_list_tools and sandworm_call to fork the template, set its parameters and run it. Then read get_report_format, write the sentences around the findings (never change a number or a verdict) and show them to the staff member. Call save_case_report only after they approve. Never put a claimant\'s name, wallet or statement into a notebook.';

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;

    if (size > maxBodyBytes) {
      throw new Error('Request body too large');
    }

    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  return raw ? (JSON.parse(raw) as unknown) : undefined;
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

/**
 * The HTTP server. It is stateless: every request gets its own MCP server and transport, so nothing is shared between callers.
 * `/mcp` needs a Clerk OAuth token; a caller without one is told where to sign in, following RFC 9728, which is how an assistant
 * finds the sign-in on its own.
 * @param deps - The settings and the check of who is calling.
 * @returns The server, not yet listening.
 */
export function createHttpServer(deps: ServerDeps): Server {
  return createServer(async (request, response) => {
    const path = (request.url ?? '').split('?')[0];

    // Browser-based clients, such as the inspector, need CORS. No cookies are used, so any origin is safe.
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': String(request.headers['access-control-request-headers'] ?? '*'),
        'Access-Control-Max-Age': '86400',
      });

      return response.end();
    }

    if (request.method === 'GET' && path === '/health') {
      return send(response, 200, { ok: true });
    }

    if (request.method === 'GET' && path?.startsWith('/.well-known/oauth-protected-resource')) {
      return send(response, 200, {
        resource: deps.publicUrl,
        authorization_servers: [deps.authServerUrl],
        bearer_methods_supported: ['header'],
      });
    }

    if (path !== '/mcp') {
      return send(response, 404, {
        error: 'Not found',
        message: 'This is the Celia MCP server. Point an MCP client at /mcp.',
      });
    }

    if (request.method !== 'POST') {
      return send(response, 405, {
        jsonrpc: '2.0',
        error: { code: -32_000, message: 'Method not allowed' },
        id: null,
      });
    }

    const caller = await deps.authenticate(request);

    if (!caller) {
      const metadata = new URL('/.well-known/oauth-protected-resource', deps.publicUrl).toString();
      response.setHeader('WWW-Authenticate', `Bearer resource_metadata="${metadata}"`);

      return send(response, 401, {
        error: 'unauthorized',
        error_description: 'Sign in to Celia to use this server',
      });
    }

    try {
      const mcp = new McpServer(
        { name: 'celia', version: '0.1.0' },
        { instructions: caller.role === 'staff' ? `${instructions} ${staffInstructions}` : instructions },
      );
      registerTools(mcp, { caller, webUrl: deps.webUrl });

      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      response.on('close', () => {
        void transport.close();
        void mcp.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(request, response, await readJsonBody(request));
    } catch (error) {
      console.error('MCP request failed', error);

      if (!response.headersSent) {
        send(response, 500, {
          jsonrpc: '2.0',
          error: { code: -32_603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });
}
