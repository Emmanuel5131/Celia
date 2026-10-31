import { createAuthenticator } from '../src/auth.ts';
import { loadConfig } from '../src/config.ts';
import { createRequestHandler } from '../src/server.ts';

const config = loadConfig();

/** The Vercel function: every path is rewritten to it (`vercel.json`), and the handler does the routing. */
export default createRequestHandler({
  authenticate: createAuthenticator(config.webUrl),
  publicUrl: config.publicUrl,
  authServerUrl: config.authServerUrl,
  webUrl: config.webUrl,
});
