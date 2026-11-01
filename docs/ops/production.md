# Going to production

What has to be true before real people use Celia. This is a checklist built from what the code reads (`apps/web/src/libs/Env.ts`) and
what was found on 2026-10-31. Each part points to the note that explains it. Nothing here is done by the app on its own.

## 1. Do first: a key is in git

`apps/web/.env` is tracked by git (it holds defaults on purpose). Commit `73ee075` (2026-10-28) put a real-looking
**`IDSWYFT_API_KEY`** in it, and `origin/main` has it. Treat it as exposed, whether or not the repository is public.

1. **Rotate the key** in Idswyft. The old one stays in history, so rotating is what makes it harmless.
2. Put the new key in the host's secret store (production) or `.env.local` (development), never in a committed file.
3. The working copy of `.env` now has the key blanked. That change is not committed yet.
4. Decide whether to scrub history (`git filter-repo` and a force push, then ask GitHub to purge cached views). It is only worth it
   if the repository is public or other people have cloned it; after rotating it is optional.
5. `src/utils/EnvFiles.test.ts` now fails if a key, secret, token or password with a long value appears in a tracked env file.

## 2. Sign-in (Clerk)

- Create the **production instance**. The app has only a `pk_test_` publishable key; production needs `pk_live_` and `sk_live_`
  (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`), set in the host's secrets.
- **The code now refuses development Clerk.** On a Vercel production deploy (`VERCEL_ENV=production`) the web app stops at build or start
  if the keys start with `pk_test_` or `sk_test_`, and the MCP server stops if `AUTH_SERVER_URL` is a `*.clerk.accounts.dev` address.
  `apps/mcp/deploy.sh` has no default for `AUTH_SERVER_URL` any more. Previews and local runs may still use the development instance.
- Turn **off dynamic client registration** on the production instance. It is a public, unauthenticated endpoint. It is on for the
  development instance only so assistants can register while testing.
- Decide how assistants sign in to the Celia MCP in production (CIMD or a pre-registered client). Claude Code prefers CIMD when it is
  offered, and that failed against the development instance ("could not be resolved").
- Require **two-step sign-in** for staff. Settings and the access rules: `staff.md`.

## 3. Settings

All validated in `Env.ts`, which stops the build on a bad value. Secrets go in the host's secret store.

| Setting | State today | Notes |
|---|---|---|
| `DATABASE_URL` | local | Production database (Neon or similar). Migrations run on `pnpm run build` |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | test | Production keys, see section 2 |
| `NEXT_PUBLIC_APP_URL` | boilerplate demo URL | `.env.production` still names `demo.nextjs-boilerplate.com`. Set the real address |
| `STAFF_EMAIL_DOMAIN` or `STAFF_EMAILS` | not set | **With neither, nobody gets into the staff area in production** |
| `SMTP_*`, `MAIL_FROM`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `MAIL_WEBHOOK_SECRET` | not set | Production refuses to send without `SMTP_HOST` and `MAIL_FROM`. `mail.md` |
| `MAIL_WARMUP_START`, `MAIL_DAILY_LIMIT` | not set | Warm-up limit for a new sending domain |
| `IDSWYFT_API_KEY` | exposed | Rotate (section 1). With it, a person must pass the identity check before reporting a loss |
| `SANDWORM_*` | local values | Section 5 |
| `INSTITUTION_PRICE` | not set | Shown to applicants before they apply. Without it the page says the fee is published before payment |
| `OPENSANCTIONS_API_KEY`, `OPENCORPORATES_API_TOKEN` | not set | Without them the application lookups show as not set up |
| `ARCJET_KEY`, Sentry, Better Stack, PostHog | not set | Optional. Bot protection, errors, logs, analytics |

`.env.production` also holds `CHECKLY_*` values from the boilerplate (an email and project name that are not yours). Replace them or
remove monitoring that depends on them.

## 4. Database

- Seed scripts (`scripts/seed/*`) refuse to run unless the database is on this machine, so they cannot touch production. Keep it so.
- Never copy local data over. The local database holds synthetic claimants.
- Back up before the first real claim, and decide who can restore.

## 5. Sandworm

Setup and limits: `sandworm.md`. For production:
- Register Celia again at Sandworm with the production callback (`https://<host>/api/sandworm/callback`), and set `SANDWORM_CLIENT_ID`.
- A shared "Celia" workspace with every staff member in it, and its id in `SANDWORM_WORKSPACE_ID`.
- A new `SANDWORM_TOKEN_KEY` (`openssl rand -base64 32`). Losing or changing it disconnects everyone.
- A data-processing agreement with Sandworm, since the notebook chat and the run happen on its infrastructure.
- There is no template notebook in Sandworm yet. Each run is built by the assistant from `docs/integrators/template/investment_platform.py`.

## 6. The MCP server (`apps/mcp`)

Deploy it separately. Its settings are `AUTH_SERVER_URL` (the production Clerk Frontend API URL), `MCP_PUBLIC_URL` (its public address,
exactly) and `WEB_URL`. `.mcp.json` at the repository root points at `localhost` and is for development only. `mcp.md` and
`docs/integrators/test-run.md` cover the flow.

## 7. Content that must not ship as it is

- **The two example cases.** Locally the app holds two examples (CB-0110 and CB-1001) so it does not look empty. Their claimants
  are **synthetic**. In a product that presents evidence to lawyers, invented victims on a case must never look real. Either start
  production empty, or add an explicit "example" marker to a case before any example is shown. This needs a decision.
- **Copy.** Every public page and label goes through the legal copy review (`.claude/agents/legal-copy-reviewer.md`): no fraud
  declarations, no promises of outcomes or fees, no funds.
- **The analysis template** (`investment-platform` 1.0.0): its thresholds and the `payout-source` definition need counsel's sign-off,
  and the per-victim loss question is still open (`docs/integrators/sandworm-analysis-contract.md`).

## 8. Known issues to close first

- The dev overlay shows "1 issue" on most pages. It comes from the root layout's theme script (a `<script>` rendered inside React).
  Fix it before launch so real users do not hit a hydration warning.
- Charts are not built yet: the report has tables only.

## 9. Checked automatically

`pnpm run lint`, `check:types`, `check:deps`, `check:i18n` and `test` (CI runs them). New today: the tracked-env-files test above.
