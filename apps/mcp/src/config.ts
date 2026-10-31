import * as z from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(6790),
  /** This endpoint's public URL, which the sign-in server checks the token was issued for. */
  MCP_PUBLIC_URL: z.url().optional(),
  /** The production domain Vercel gives the project, without a scheme. It stands in for `MCP_PUBLIC_URL` there. */
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  /** The Clerk Frontend API URL: the issuer of the tokens, where an assistant signs in. */
  AUTH_SERVER_URL: z.url(),
  /** The Celia web app, which knows who is calling and holds the cases. */
  WEB_URL: z.url().default('http://localhost:3000'),
});

export type Config = {
  port: number;
  publicUrl: string;
  authServerUrl: string;
  webUrl: string;
};

/**
 * Reads and checks the settings: this app's `Env.ts`, which is why it may read the process environment itself. A missing or wrong
 * one stops the server at start, with every problem listed.
 * @param env - The environment; the process's by default.
 * @returns The settings.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment:\n${problems}`);
  }

  const { data } = parsed;

  return {
    port: data.PORT,
    publicUrl:
      data.MCP_PUBLIC_URL ??
      (data.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${data.VERCEL_PROJECT_PRODUCTION_URL}/mcp`
        : `http://localhost:${data.PORT}/mcp`),
    authServerUrl: data.AUTH_SERVER_URL.replace(/\/$/u, ''),
    webUrl: data.WEB_URL.replace(/\/$/u, ''),
  };
}
