import * as z from 'zod';
import { Env } from '@/libs/Env';
import { getBaseUrl } from '@/utils/Helpers';

const ResourceValidation = z.object({
  resource: z.string(),
  authorization_servers: z.array(z.string()).min(1),
});

const ServerValidation = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
});

const TokensValidation = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

const MessageValidation = z.object({
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
});

export type SandwormTokens = z.infer<typeof TokensValidation>;

/** The cookie that holds a sign-in's sealed verifier and state between the redirect to Sandworm and the callback. */
export const sandwormCookie = 'sandworm_oauth';

/** What the sealed cookie holds. */
export const PendingValidation = z.object({
  state: z.string(),
  verifier: z.string(),
  userId: z.string(),
});

/**
 * Where Sandworm's sign-in and token endpoints are, read from its metadata instead of being written down here, because Sandworm
 * is strict about the `resource` value it advertises.
 * @returns The `resource` to send, and the two endpoints.
 */
export async function discoverSandworm() {
  const { origin } = new URL(Env.SANDWORM_MCP_URL);
  const resourceResponse = await fetch(`${origin}/.well-known/oauth-protected-resource`);
  const resource = ResourceValidation.parse(await resourceResponse.json());
  const [issuer = ''] = resource.authorization_servers;
  const serverResponse = await fetch(`${issuer}/.well-known/oauth-authorization-server`);
  const server = ServerValidation.parse(await serverResponse.json());

  return {
    resource: resource.resource,
    authorizationEndpoint: server.authorization_endpoint,
    tokenEndpoint: server.token_endpoint,
  };
}

/**
 * The callback Celia registered at Sandworm. Sandworm accepts only this exact string.
 * @returns The address.
 */
export function sandwormRedirectUri() {
  return `${getBaseUrl()}/api/sandworm/callback`;
}

async function requestTokens(body: Record<string, string>) {
  const { tokenEndpoint } = await discoverSandworm();
  // Sandworm's token endpoint reads JSON, not the usual form body.
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  // A code or refresh token that is spent, expired or wrong is a 400; it means "sign in again", not an outage.
  if (response.status === 400 || response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Sandworm could not answer (${response.status})`);
  }

  return TokensValidation.parse(await response.json());
}

/**
 * Trades the code Sandworm sent back for tokens.
 * @param options - What the sign-in started with.
 * @param options.code - The single-use code from the callback.
 * @param options.verifier - The PKCE verifier kept since the sign-in began.
 * @param options.clientId - Celia's client id.
 * @returns The tokens, or null when Sandworm refused the code.
 */
export async function exchangeCode(options: { code: string; verifier: string; clientId: string }) {
  return await requestTokens({
    grant_type: 'authorization_code',
    code: options.code,
    code_verifier: options.verifier,
    redirect_uri: sandwormRedirectUri(),
    client_id: options.clientId,
  });
}

/**
 * Trades a refresh token for new tokens. Sandworm returns a new refresh token every time, and the old one stops working.
 * @param refreshToken - The latest refresh token.
 * @returns The tokens, or null when the refresh token has expired or was already used.
 */
export async function refreshTokens(refreshToken: string) {
  return await requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

/**
 * Sends one request to the Sandworm MCP. The server keeps no session, so each request stands alone.
 * @param accessToken - The staff member's access token.
 * @param method - The MCP method, `tools/list` or `tools/call`.
 * @param params - Its parameters.
 * @returns The result, or `unauthorized` when the token is expired or revoked.
 * @throws {Error} When Sandworm answers with an error.
 */
export async function sandwormRequest(
  accessToken: string,
  method: 'tools/list' | 'tools/call',
  params: Record<string, unknown>,
) {
  const response = await fetch(Env.SANDWORM_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    // Starting a run can take a while on Sandworm's side.
    signal: AbortSignal.timeout(60_000),
  });

  if (response.status === 401) {
    return { status: 'unauthorized' as const };
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Sandworm could not answer (${response.status})`);
  }

  // The reply is plain JSON or a single server-sent event.
  const data = text.startsWith('{')
    ? text
    : text
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.slice(5);
  const message = MessageValidation.parse(JSON.parse(data ?? 'null'));

  if (message.error) {
    throw new Error(`Sandworm refused it: ${message.error.message}`);
  }

  return { status: 'ok' as const, result: message.result };
}
