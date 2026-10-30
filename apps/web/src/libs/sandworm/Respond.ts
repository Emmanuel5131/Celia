import { privateJson } from '@/libs/mcp/McpCaller';
import type { SandwormOutcome } from '@/libs/sandworm/Proxy';

// What the assistant is told when Celia did not make the call. `fix` says what to do next, so it can pass that on to the staff member.
const refusals = {
  not_set_up: {
    status: 503,
    fix: 'Sandworm is not set up in Celia. Tell the staff member; it needs the Sandworm client id, workspace id and token key (docs/ops/sandworm.md).',
  },
  not_connected: {
    status: 409,
    fix: 'The staff member has not connected Sandworm, or the connection ran out. Ask them to open Staff, Sandworm in Celia and press Connect Sandworm.',
  },
  claimant_wallet: {
    status: 422,
    fix: "The call carries the wallet of someone who filed a claim. Claimant wallets never go to Sandworm. Use the platform's own addresses instead.",
  },
} as const;

/**
 * Turns what came of a Sandworm call into the answer the MCP server gets.
 * @param outcome - The outcome.
 * @returns Sandworm's answer as JSON, or the reason Celia did not make the call.
 */
export function sandwormJson(outcome: SandwormOutcome) {
  if (outcome.status === 'ok') {
    return privateJson(outcome.result);
  }

  const { status, fix } = refusals[outcome.status];

  return privateJson({ problem: outcome.status, fix }, status);
}
