import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

const development = 'https://becoming-marmoset-801.clerk.accounts.dev';
const production = 'https://clerk.example.org';

describe('loadConfig', () => {
  it('allows a development Clerk instance on a machine and on a preview', () => {
    expect(loadConfig({ AUTH_SERVER_URL: development }).authServerUrl).toBe(development);
    expect(loadConfig({ AUTH_SERVER_URL: development, VERCEL_ENV: 'preview' }).authServerUrl).toBe(
      development,
    );
  });

  it('refuses a development Clerk instance in production', () => {
    expect(() => loadConfig({ AUTH_SERVER_URL: development, VERCEL_ENV: 'production' })).toThrow(
      'Clerk development instance',
    );
  });

  it('allows the production instance in production', () => {
    expect(loadConfig({ AUTH_SERVER_URL: production, VERCEL_ENV: 'production' }).authServerUrl).toBe(
      production,
    );
  });
});
