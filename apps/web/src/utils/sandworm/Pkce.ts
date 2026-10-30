import { createHash, randomBytes } from 'node:crypto';

/**
 * Makes the secrets for one sign-in with PKCE: a verifier that stays on the server, the challenge Sandworm gets in its place, and a
 * state value that ties the return to the person who started it.
 * @returns The verifier, its S256 challenge and the state.
 */
export function createPkce() {
  const verifier = randomBytes(32).toString('base64url');

  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: randomBytes(16).toString('base64url'),
  };
}

/**
 * Builds the address that sends a staff member to Sandworm to sign in and approve.
 * @param options - What Sandworm needs.
 * @param options.endpoint - Sandworm's authorization endpoint, from its metadata.
 * @param options.clientId - Celia's registered client id.
 * @param options.redirectUri - The registered callback, exactly as registered.
 * @param options.resource - The `resource` field of Sandworm's metadata, exactly; anything else is a 400.
 * @param options.challenge - The PKCE challenge.
 * @param options.state - The state to check on return.
 * @returns The address.
 */
export function authorizeUrl(options: {
  endpoint: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  challenge: string;
  state: string;
}) {
  const url = new URL(options.endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
    resource: options.resource,
    state: options.state,
  }).toString();

  return url.toString();
}
