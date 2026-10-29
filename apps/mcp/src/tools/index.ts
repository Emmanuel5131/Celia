import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Caller, Role } from '../auth.ts';
import { createWebClient } from '../web.ts';
import type { WebClient } from '../web.ts';
import { registerCaseTools } from './cases.ts';
import { registerFirmTools } from './firm.ts';
import { registerMyClaimTools } from './my-claims.ts';
import { registerStaffTools } from './staff.ts';

type ToolSet = (server: McpServer, web: WebClient) => void;

/**
 * Which tools each kind of caller gets. A role is a floor, not the check: the web app decides again on every request, so a tool
 * missing here is never reachable and a tool listed here never shows more than the caller may see. Everyone reviews the case bank;
 * a person also gets their own claims, a lawyer the cases their firm leads, and staff the review queues.
 */
const toolSets: Record<Role, ToolSet[]> = {
  staff: [registerCaseTools, registerStaffTools],
  counsel: [registerCaseTools, registerFirmTools],
  person: [registerCaseTools, registerMyClaimTools],
};

/**
 * Registers the tools the caller's role gets.
 * @param server - The MCP server for this request.
 * @param options - Who is calling and where the web app is.
 * @param options.caller - Who is calling.
 * @param options.webUrl - The Celia web app.
 */
export function registerTools(server: McpServer, options: { caller: Caller; webUrl: string }) {
  const web = createWebClient(options.webUrl, options.caller);

  for (const register of toolSets[options.caller.role]) {
    register(server, web);
  }
}
