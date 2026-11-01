import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';
// Relative, not `@/`: `next.config.ts` loads this file before Next resolves the alias.
import { clerkKeyProblem } from '../utils/ClerkKeys';

export const Env = createEnv({
  server: {
    ARCJET_KEY: z.string().startsWith('ajkey_').optional(),
    CLERK_SECRET_KEY: z.string().min(1),
    /** The Idswyft key. In production, with it, a person must pass the one-time identity check before reporting a loss; without it, or in development, there is no check. */
    IDSWYFT_API_KEY: z.string().min(1).optional(),
    /** `true` to use Idswyft's sandbox, which accepts test documents. */
    IDSWYFT_SANDBOX: z.enum(['true', 'false']).optional(),
    DATABASE_URL: z.string().min(1),
    /** The mail server. Optional in development, where mail goes to a local catcher; required in production. */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    /** `true` for implicit TLS (port 465); otherwise the connection upgrades with STARTTLS. */
    SMTP_SECURE: z.enum(['true', 'false']).optional(),
    /** The sender shown to people, such as `Celia <notifications@mail.example.org>`. */
    MAIL_FROM: z.string().optional(),
    MAIL_REPLY_TO: z.string().optional(),
    /** The day sending began, as `2026-11-01`. Turns on the warm-up limit. */
    MAIL_WARMUP_START: z.iso.date().optional(),
    /** The most emails to send in one day once warmed up. */
    MAIL_DAILY_LIMIT: z.coerce.number().int().positive().default(2000),
    /** The bearer secret the scheduler sends to the drain route. */
    CRON_SECRET: z.string().min(16).optional(),
    /** Signs unsubscribe links. */
    UNSUBSCRIBE_SECRET: z.string().min(32).optional(),
    /** Verifies the mail server's bounce and complaint webhooks. */
    MAIL_WEBHOOK_SECRET: z.string().min(16).optional(),
    /** The emails of Celia staff, separated by commas. In production only these accounts can use the staff area, and an empty list lets nobody in. */
    STAFF_EMAILS: z.string().optional(),
    /** The Celia email domain, such as `celia.example`. A staff member's verified email must be on it (or on `STAFF_EMAILS`). */
    STAFF_EMAIL_DOMAIN: z.string().optional(),
    /** Set to `off` to let staff into production without two-step sign-in. Only for when the sign-in provider cannot offer it; leave unset otherwise. */
    STAFF_TWO_FACTOR: z.enum(['on', 'off']).optional(),
    /** The flat fee for institutions, as shown to applicants, such as `€1,200 a year`. Shown before anyone applies; when unset the page says the fee is published before payment. It is invoiced outside the app. */
    INSTITUTION_PRICE: z.string().optional(),
    /** OpenSanctions, for the sanctions lookup on an application. Without it the lookup shows as not set up. */
    OPENSANCTIONS_API_KEY: z.string().min(1).optional(),
    /** OpenCorporates, for the company registry lookup on an application. Without it the lookup shows as not set up. */
    OPENCORPORATES_API_TOKEN: z.string().min(1).optional(),
    /** Pinata's JWT, to pin evidence files to IPFS. Without it staff cannot upload files. Files are public and permanent once pinned. */
    PINATA_JWT: z.string().min(1).optional(),
    /** The Pinata gateway host that serves pinned files, such as `example.mypinata.cloud`. Without it the public Pinata gateway is used. */
    PINATA_GATEWAY: z.string().min(1).optional(),
    /** The Sandworm MCP that staff research runs on. */
    SANDWORM_MCP_URL: z.url().default('https://mcp.sandwormlab.xyz/mcp'),
    /** Celia's client id at Sandworm, from the one-time registration in `docs/ops/sandworm.md`. Without it staff cannot connect Sandworm. */
    SANDWORM_CLIENT_ID: z.string().min(1).optional(),
    /** The id of the shared Celia workspace in Sandworm. Every call is sent to it, whatever workspace the staff member used last. */
    SANDWORM_WORKSPACE_ID: z.string().min(1).optional(),
    /** Seals each staff member's Sandworm login in the database: 32 random bytes in base64 (`openssl rand -base64 32`). */
    SANDWORM_TOKEN_KEY: z
      .string()
      .refine((key) => Buffer.from(key, 'base64').length === 32, {
        message: 'Must be 32 bytes in base64',
      })
      .optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_LOGGING_LEVEL: z
      .enum(['error', 'info', 'debug', 'warning', 'trace', 'fatal'])
      .default('info'),
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
    /** Set by Vercel: `production` only on a real production deploy, where Clerk development keys are refused. */
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  },
  // You need to destructure all the keys manually
  runtimeEnv: {
    ARCJET_KEY: process.env.ARCJET_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    IDSWYFT_API_KEY: process.env.IDSWYFT_API_KEY,
    IDSWYFT_SANDBOX: process.env.IDSWYFT_SANDBOX,
    DATABASE_URL: process.env.DATABASE_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE: process.env.SMTP_SECURE,
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
    MAIL_WARMUP_START: process.env.MAIL_WARMUP_START,
    MAIL_DAILY_LIMIT: process.env.MAIL_DAILY_LIMIT,
    CRON_SECRET: process.env.CRON_SECRET,
    UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET,
    MAIL_WEBHOOK_SECRET: process.env.MAIL_WEBHOOK_SECRET,
    STAFF_EMAILS: process.env.STAFF_EMAILS,
    STAFF_EMAIL_DOMAIN: process.env.STAFF_EMAIL_DOMAIN,
    STAFF_TWO_FACTOR: process.env.STAFF_TWO_FACTOR,
    INSTITUTION_PRICE: process.env.INSTITUTION_PRICE,
    OPENSANCTIONS_API_KEY: process.env.OPENSANCTIONS_API_KEY,
    OPENCORPORATES_API_TOKEN: process.env.OPENCORPORATES_API_TOKEN,
    PINATA_JWT: process.env.PINATA_JWT,
    PINATA_GATEWAY: process.env.PINATA_GATEWAY,
    SANDWORM_MCP_URL: process.env.SANDWORM_MCP_URL,
    SANDWORM_CLIENT_ID: process.env.SANDWORM_CLIENT_ID,
    SANDWORM_WORKSPACE_ID: process.env.SANDWORM_WORKSPACE_ID,
    SANDWORM_TOKEN_KEY: process.env.SANDWORM_TOKEN_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_LOGGING_LEVEL: process.env.NEXT_PUBLIC_LOGGING_LEVEL,
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
});

// Server only: the secret key does not exist in the browser, and reading it there throws.
const clerkProblem =
  typeof window === 'undefined'
    ? clerkKeyProblem({
        deploy: Env.VERCEL_ENV,
        publishableKey: Env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        secretKey: Env.CLERK_SECRET_KEY,
      })
    : null;

if (clerkProblem) {
  throw new Error(clerkProblem);
}
