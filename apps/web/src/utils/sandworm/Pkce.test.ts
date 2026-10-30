import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authorizeUrl, createPkce } from './Pkce';

describe(createPkce, () => {
  it('derives the challenge from the verifier with S256', () => {
    const { verifier, challenge } = createPkce();

    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('makes new secrets each time', () => {
    expect(createPkce().verifier).not.toBe(createPkce().verifier);
    expect(createPkce().state).not.toBe(createPkce().state);
  });
});

describe(authorizeUrl, () => {
  it('carries everything Sandworm checks', () => {
    const url = new URL(
      authorizeUrl({
        endpoint: 'https://app.example/authorize',
        clientId: 'client',
        redirectUri: 'https://celia.example/api/sandworm/callback',
        resource: 'https://mcp.example/mcp',
        challenge: 'challenge',
        state: 'state',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://app.example/authorize');
    expect(Object.fromEntries(url.searchParams)).toStrictEqual({
      response_type: 'code',
      client_id: 'client',
      redirect_uri: 'https://celia.example/api/sandworm/callback',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      resource: 'https://mcp.example/mcp',
      state: 'state',
    });
  });
});
