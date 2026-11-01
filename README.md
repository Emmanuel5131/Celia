# Celia

Celia is a case bank for crypto fraud. It stores what happened, who is alleged to have run a platform, and what the chain shows. It does not declare fraud, because a court decides intent, and it holds no funds. Anything about people is called alleged, and every finding says what is proven and what is not.

Claimants file claims. Celia staff check them, group them into cases by platform, research the chain and save a report. Verified lawyers can then read sealed cases.

## Repository

| Path                 | What it is                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web`           | The Celia app (Next.js, Clerk, Drizzle). Pages, staff area, migrations, tests and tool configs.     |
| `apps/mcp`           | The MCP server. Lets an AI assistant work cases as the staff member who signed in.                  |
| `apps/landing`       | The marketing site (Astro).                                                                         |
| `packages/core`      | Shared domain code: wallet addresses, ownership proofs, platform keys. Pure TypeScript.             |
| `packages/jurisdictions` | Jurisdiction data used by claims and cases.                                                     |
| `docs`               | Design and product notes. Start with `docs/DESIGN.md`, `docs/mcp.md` and the runbooks in `docs/ops`. |

## Getting started

Requires Node 24 and pnpm 10.

```shell
pnpm install
pnpm dev
```

Put your settings in `apps/web/.env.local` first.

`pnpm dev` starts the app with a local PGlite database (`apps/web/local.db`) and runs the migrations. Every environment variable is validated in `apps/web/src/libs/Env.ts`.

Other servers:

```shell
pnpm dev:landing   # marketing site
pnpm dev:mcp       # MCP server
```

## Scripts

Run these from the repo root.

| Script                | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `pnpm build-local`    | Builds the app against a throwaway in-memory database. |
| `pnpm lint`           | Lints the web app.                                     |
| `pnpm check:types`    | Type-checks the web app and the MCP server.            |
| `pnpm check:deps`     | Finds unused files and dependencies.                   |
| `pnpm check:i18n`     | Checks translation keys.                               |
| `pnpm test`           | Runs unit tests for the web app and the MCP server.    |
| `pnpm test:e2e`       | Runs the Playwright tests.                             |

## Sample data

`pnpm --filter @celia/web run db:seed` fills a database with invented cases, claims, claimants and reports. Claimants are named `seed_user_*`, and running it again replaces only those rows.

- It refuses to run against a database that is not on your machine. Passing `--live` overrides that. Use it only on purpose, because the sample cases and their findings are invented and show up in the app like real ones.
- `--cases <n>` sets how many cases (default 1000).
- A few claimants are real accounts in a Clerk **development** instance, so you can sign in as them: for example `staff+clerk_test@example.com` with the test code `424242`. The seed refuses to create accounts with a production Clerk key.
- `apps/web/scripts/seed/clear.ts` removes the sample cases and keeps a few as examples.

## Staff area

`/dashboard/staff` is for the Celia team only. A person gets in only when their Clerk account has `publicMetadata.staff`, their verified email is on `STAFF_EMAIL_DOMAIN` or in `STAFF_EMAILS`, and (in production) two-step sign-in is on. Everyone else gets a 404. See `docs/ops/staff.md`.

## MCP server

The MCP server exposes the staff workflow to an AI assistant: reading cases, researching claims, and saving reports. Every write shows a summary first and changes nothing until a staff member says yes. When you add it as a connector, use the `/mcp` path, for example `https://<your-host>/mcp`. The root address returns 404. `GET /health` returns 200 when the server is up. See `docs/mcp.md` and `docs/ops/mcp.md`.

## Contributing

- Commits follow Conventional Commits: `type: summary`, no scope.
- Read `AGENTS.md` before changing code. It sets the rules for structure, React, i18n, UI, tests and accounts.
- Account type is written to Clerk `publicMetadata` by the server only. Never put an account type or review status in `unsafeMetadata`.

## License

See `LICENSE`.
