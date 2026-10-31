import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IdentityUnavailableError } from './auth.ts';
import { createHttpServer } from './server.ts';

const publicUrl = 'https://mcp.example.org/mcp';
const server = createHttpServer({
  authenticate: async () => null,
  publicUrl,
  authServerUrl: 'https://auth.example.org',
  webUrl: 'https://app.example.org',
});
const unavailable = createHttpServer({
  authenticate: async () => {
    throw new IdentityUnavailableError();
  },
  publicUrl,
  authServerUrl: 'https://auth.example.org',
  webUrl: 'https://app.example.org',
});
let base = '';
let unavailableBase = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  const address = server.address();

  base = typeof address === 'object' && address ? `http://localhost:${address.port}` : '';

  await new Promise<void>((resolve) => {
    unavailable.listen(0, resolve);
  });
  const other = unavailable.address();

  unavailableBase = typeof other === 'object' && other ? `http://localhost:${other.port}` : '';
});

afterAll(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
  await new Promise((resolve) => {
    unavailable.close(resolve);
  });
});

describe('MCP server', () => {
  it('answers a health check', async () => {
    const response = await fetch(`${base}/health`);

    expect(await response.json()).toStrictEqual({ ok: true });
  });

  it('names the sign-in server for assistants', async () => {
    const response = await fetch(`${base}/.well-known/oauth-protected-resource`);

    expect(await response.json()).toMatchObject({
      resource: publicUrl,
      authorization_servers: ['https://auth.example.org'],
    });
  });

  it('turns away a caller who is not signed in and says where to sign in', async () => {
    const response = await fetch(`${base}/mcp`, { method: 'POST', body: '{}' });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('oauth-protected-resource');
    expect(response.headers.get('www-authenticate')).toContain('offline_access');
  });

  it('says it is unavailable, not signed out, when the web app cannot check the token', async () => {
    const response = await fetch(`${unavailableBase}/mcp`, { method: 'POST', body: '{}' });

    expect(response.status).toBe(503);
    expect(response.headers.get('www-authenticate')).toBeNull();
  });

  it('only takes POST on the MCP path', async () => {
    const response = await fetch(`${base}/mcp`);

    expect(response.status).toBe(405);
  });
});
