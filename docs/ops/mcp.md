# The Celia MCP server

`apps/mcp` lets an AI assistant review cases in the case bank. It is modelled on Sandworm's MCP server: a small standalone Node
server that is **stateless** (each request gets its own MCP server) and holds no data and no Clerk secret.

## How a request flows

1. The assistant calls `POST /mcp`. With no token it gets a `401` and a `WWW-Authenticate` header pointing at
   `/.well-known/oauth-protected-resource`, which names Clerk as the sign-in server. The assistant signs the person in with
   Clerk's OAuth and comes back with a token.
2. The MCP server asks the web app who the token belongs to (`GET /api/mcp/me`). The web app has Clerk check the OAuth token,
   then works out the role: `staff` (only if the person passes the same rules as the staff area), `counsel` or `person`.
3. The role chooses the tool set (`apps/mcp/src/tools/index.ts`). Each tool calls a route under `/api/mcp/*` with the same token, and
   each route accepts only the roles it is for (`identifyMcpCallerWithRole`).
   **The web app decides what the person may see on every request**, so the MCP server can never show more than the app does.

## Tools by role

The role comes from the person's account and decides which tools the assistant sees. The web app checks the role again on every
route, so a tool that is not listed for a role is never reachable by it.

| Tool | Route | staff | lawyer | person |
|---|---|---|---|---|
| `list_cases`, `get_case`, `get_report` | `/api/mcp/cases...` | yes | yes | yes |
| `list_my_claims`, `get_my_claim` | `/api/mcp/my/claims...` | | | their own |
| `list_my_cases` | `/api/mcp/firm/cases` | | cases their firm leads | |
| `get_case_claims` | `/api/mcp/firm/cases/:id/claims` | | a case their firm leads | |
| `staff_overview` | `/api/mcp/staff/overview` | yes | | |
| `list_claims_to_review` | `/api/mcp/staff/claims` | yes | | |
| `list_claims` | `/api/mcp/staff/claims/all?page=&search=` | yes | | |
| `get_case_claim_accounts` | `/api/mcp/staff/cases/:id/claims?page=` | yes | | |
| `get_report_format` | `/api/mcp/staff/report-format` | yes | | |
| `sandworm_list_tools` | `/api/mcp/staff/sandworm/tools` | yes | | |
| `sandworm_call` (**writes**) | `POST /api/mcp/staff/sandworm/call` | yes | | |
| `save_case_report` (**writes**) | `POST /api/mcp/staff/cases/:id/report` | yes | | |

- **Case bank tools** return the same summary the case bank shows: stage, victims and confirmed victims, where the victims are, the
  alleged operators and the report.
- **A person** sees only their own claims, as the claims table shows them: no statement, nonce or signature.
- **A lawyer** sees the claims of a case their firm leads: kind of loss, wallet, transaction, amount, country, whether the wallet is
  signed and whether Celia confirmed it. **No name and no statement.** Passing wallet addresses to an assistant is a data-protection
  choice: remove `registerFirmTools`'s `get_case_claims` if it should not be offered.
- **Staff** see the queue counts and the claims waiting, without name, email, wallet address or proof files. Staff must pass the same
  rules as the staff area (flag, allow list, two-step sign-in in production).
- **Sandworm:** this server does not hold a Sandworm login. The web app does, one per staff member, sealed in its database: the
  person presses Connect Sandworm in the staff area once, and `sandworm_call` then reaches the Sandworm MCP as them, in Celia's
  workspace, with claimants' wallets refused and every call in the staff audit. Setup and limits: `sandworm.md`.
- **`save_case_report` and `sandworm_call` write.** `save_case_report` is the only one that changes the case bank. An agent researches (for example in a Sandworm notebook, which the report links
  through `method.notebookUrl`) and a person validates: the tool says to show the findings to the staff member and save only after
  they approve. The web app checks the findings with the same rules as the staff area (`saveCheckedReport`: report format, house
  language, a table for every test, a readable loss), keeps earlier versions, and writes a `staff_audit` row with `via: mcp` in the
  same transaction. A refused report comes back as 422 with the problem to fix.

## Setting it up

1. In the Clerk dashboard, turn on OAuth applications and **dynamic client registration** (assistants register themselves).
2. Copy `apps/mcp/.env.example` to `apps/mcp/.env`. `AUTH_SERVER_URL` is the Clerk Frontend API URL of the instance.
3. Run the web app, then `pnpm run dev:mcp`. Try it with `pnpm dlx @modelcontextprotocol/inspector` against
   `http://localhost:6790/mcp`.

This has not been run against a live Clerk instance yet. The first sign-in is the real test of steps 1 and 2.

## Adding a tool

Add a route under `apps/web/src/app/api/mcp/`, start it with `identifyMcpCaller()` and check the role it needs, then register the
tool in `apps/mcp/src/tools/` and add it to the right role in `toolSets`. A tool that changes anything must also write a
`staff_audit` row on the web side.

- **`list_claims`** reads every claim, 25 to a page, searchable by the platform, person or group name or the contact handle. No
  claimant name, email, wallet, transaction, proof or account.
- **`get_case_claim_accounts`** reads one case's claims with each claimant's own account of what happened, so the assistant can
  propose **alleged actions** from them. The accounts are free text and can hold a name or a wallet; the tool description tells the
  assistant to copy neither and to show the staff member each proposed action before `add_alleged_action`. It is staff only.
- **`review_evidence`** records the review of off-chain evidence (reviewed, or unverified) with a note. Like every change, it asks for
  a summary first and runs only with `confirmed: true`.
