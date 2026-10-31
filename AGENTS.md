# AGENTS

## Structure
- `packages/core` (`@celia/core`): domain code shared by the web app and, later, the worker (wallet addresses, ownership proofs, platform keys). Pure TypeScript with tests; no framework imports.
- `apps/web`: the Celia app (Next.js). All `src/`, tests, migrations and tool configs live here.
- `apps/landing`: the marketing site (Astro), own `package.json`. Flat `src/components` with one `Section*.astro` per section.
- `docs/`: design and product notes. The root only holds workspace config, CI, hooks and these guides.
- Run the scripts below from the repo root; they forward to `apps/web`.

## Principles
- Clarity and consistency over cleverness. Minimal changes. Match existing patterns.
- Keep components/functions short; break down when it improves structure.
- TypeScript everywhere; no `any` unless isolated and necessary.
- No unnecessary `try/catch`. Avoid casting; use narrowing.
- Named exports only (no default exports, except Next.js pages).
- Absolute imports via `@/` unless same directory.
- Follow existing ESLint setup; don't reformat unrelated code.
- Zod: `import type * as z from 'zod';` where only the type is used; a file that builds or runs a schema imports it normally (`import * as z from 'zod';`).
- Let compiler infer return types unless annotation adds clarity.
- Options object for 3+ params, optional flags, or ambiguous args.
- Hypothesis-driven debugging: 1-3 causes, validate most likely first.

## Token efficiency
- Skip recaps unless the result is ambiguous or you need more input.

## Commands
Only these `pnpm run` scripts: `build-local`, `lint`, `check:types`, `check:deps`, `check:i18n`, `test`, `test:e2e`.

## Git Commits
Conventional Commits: `type: summary` without scope. The summary should be a short, specific sentence that explains what changed and where or why, not a vague phrase. Types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`. `BREAKING CHANGE:` footer when needed.

## Accounts
- Account type (`person` or `counsel`) is written to Clerk `publicMetadata` by the server only, in onboarding; read it with `parseAccount`. There is no default type: no type means onboarding.
- Never put an account type or review status in `unsafeMetadata`. Counsel start `pending`; only staff set `verified`.

## Env
All env vars validated in `Env.ts`; never read `process.env` directly.

## Styling
Tailwind v4 utility classes. Reuse shared components. Responsive. No unnecessary classes.

## UI (apps/web)
- Build screens from `components/ui` (shadcn on Radix) and `components/layout`; no raw `button`/`input`/`table` or hand-built cards. Add missing parts with `pnpm dlx shadcn@latest add <name>`, then restyle to `docs/DESIGN.md` §12.
- Frame is `shell/AppShell` (shadcn Sidebar); stats and panels are `Card` (`CardValue`), steps and activity are `Timeline`, sections are `PageSection`.
- Every table is `data-table/DataTable` (TanStack Table); columns live at module scope via `createAppColumnHelper`. Never build a one-off table.
- Pages use `PageContainer` + `PageHeader`; spacing on the 8pt scale (`p-2/4/6/8`, `gap-*` likewise); controls take their height from the control tokens, never `h-*`.
- Icons: Phosphor regular only (`@phosphor-icons/react`, `Icon` suffix); no weight or size props.
- Colours and radius come from tokens (`bg-ink`, `bg-paper`, `text-ink-muted`, `border-border`); no hex values or ad-hoc palette classes. The app has light and dark mode: use `text-on-ink` on an ink fill (not `text-white`) and check new screens in both. Seal red only for a verdict or finding.
- `components/ui/*` follow shadcn's own style (destructured props) so they stay easy to update; everything else follows the React rules below.

## React
- No `useMemo`/`useCallback` (React compiler handles it). Avoid `useEffect`.
- Single `props` param with inline type; access as `props.foo` (no destructuring).
- Use `React.ReactNode`, not `ReactNode`.
- Inline short event handlers; extract only when complex.

## Pages
- Default export name ends with `Page`. Props alias (if reused) ends with `PageProps`.
- Locale pages: `props: { params: Promise<{ locale: string }> }` → `await props.params` → `setRequestLocale(locale)`.
- Escape glob chars in shell commands for Next.js paths.
- Dashboard pages (sit behind auth): each page sets its own title and description with `generateMetadata` (the root layout adds " · Celia"); the dashboard layout adds `noindex`. Do not repeat `noindex` in pages.

## i18n (next-intl)
- Never hard-code user-visible strings. Page namespaces end with `Page`.
- Server: `getTranslations`; Client: `useTranslations`.
- Context-specific keys (`card_title`, `meta_description`). Use `t.rich(...)` for markup.
- Use sentence case for translations.
- Error messages: short, no "try again" variants.

## JSDoc
- Start each block with `/**` directly above the symbol.
- Short, sentence-case, present-tense description of intent.
- Order: description → `@param` → `@returns` → `@throws` (only if it can throw).

## Tests
- `*.test.ts` for unit tests; `*.integ.ts` for integration tests; `*.e2e.ts` for Playwright tests.
- `*.test.ts` co-located with implementation; `*.integ.ts` and `*.e2e.ts` in `tests/` directory.
- Top `describe` = subject; nested `describe` to group scenarios or contexts.
- `it` titles: short, third-person present, `verb + object + context`. Sentence case, no period.
- Omit "should/works/handles/checks/validates". State what, not how.
- Avoid mocking unless necessary.
