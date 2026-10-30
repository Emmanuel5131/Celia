# Sandworm from Celia

Research runs on Sandworm. Celia's web app signs in to the Sandworm MCP **as the staff member**, so the Celia assistant can build and
run notebooks through two tools (`sandworm_list_tools`, `sandworm_call`) without a second MCP connection. The protocol is in
`docs/integrators/celia-mcp.md`; this note is how Celia uses it.

**Status:** built and checked (types, tests, lint). **Not yet run against production Sandworm**: the first real sign-in is the test.
Run `docs/integrators/celia-connect.mjs` first; if that works, this will.

## Why the web app does it, and not the MCP server

`apps/mcp` holds no data and no secrets. A Sandworm login is a full login, so it lives in the web app's database, sealed, one per
staff member. The MCP server only asks the web app, with the assistant's Celia token, and the web app decides.

```
assistant -> Celia MCP (sandworm_call) -> web app /api/mcp/staff/sandworm/call -> Sandworm MCP
                                           staff rules, wallet check, audit,        as the staff member
                                           Celia's workspace, their own token
```

What this adds over connecting Sandworm's MCP beside Celia's:

- **Celia's workspace is forced.** Every call carries `SANDWORM_WORKSPACE_ID`, never the person's last-used workspace.
- **Claimant wallets are refused.** A notebook keeps its chat, and an attested one is public for good. Every word in a call that
  looks like an address is checked against the wallets on claims (`claim.wallet_address` and `claim_address` with role `affected`).
  The platform's own (receiving) addresses are allowed. A match is a 422 and the call is not made.
- **Every call is in the staff audit** (`sandworm_called`, with the tool name and `via: mcp`, never the arguments), written before the
  call is made. A refused call is recorded too.
- **Only staff.** The routes need the same rules as the staff area (flag, allow list, two-step sign-in in production).

## Setting it up (once)

1. **Register Celia at Sandworm.** Registration is open and never expires. Register every address the app runs on:

   ```bash
   curl -X POST https://app.sandwormlab.xyz/api/oauth/register \
     -H 'content-type: application/json' \
     -d '{"client_name":"Celia","redirect_uris":["https://<celia-host>/api/sandworm/callback","http://localhost:3000/api/sandworm/callback"]}'
   ```

   The reply has `client_id`. The callback must match a registered address exactly, and `getBaseUrl()` (`NEXT_PUBLIC_APP_URL`) decides
   which one Celia sends.
2. **Make the shared workspace.** In Sandworm create a "Celia" workspace and invite every staff member. Get its id from
   `list_workspaces` (the output of `celia-connect.mjs` shows it).
3. **Set the environment** (all validated in `Env.ts`):

   | Setting | Value |
   |---|---|
   | `SANDWORM_CLIENT_ID` | the `client_id` from step 1 |
   | `SANDWORM_WORKSPACE_ID` | the workspace id from step 2 |
   | `SANDWORM_TOKEN_KEY` | `openssl rand -base64 32`. **Losing or changing it disconnects everyone.** |
   | `SANDWORM_MCP_URL` | optional; defaults to `https://mcp.sandwormlab.xyz/mcp` |

4. **Run the migration** (`sandworm_connection` table; it runs with `pnpm run build`).

## Each staff member (once, then weekly use keeps it alive)

Open **Staff, Sandworm** and press **Connect Sandworm**. Sign in on Sandworm's page with your own account, pick the Celia workspace,
approve. You come back to the page with "Sandworm is connected". **Disconnect** deletes your stored login.

- Access tokens last 15 minutes and refresh tokens 7 days. Celia refreshes when a call needs it, so an unused connection costs
  nothing; after a week of silence the person presses Connect again.
- Every refresh gives a new refresh token and the old one stops working, so the row is locked while one refresh runs. Two assistants
  calling at once cannot lose the connection.
- A login Sandworm no longer accepts is deleted, and the next call says `not_connected`.

## What the assistant sees when a call is not made

| Answer | Meaning |
|---|---|
| 503 `not_set_up` | the client id, workspace id or token key is missing |
| 409 `not_connected` | the staff member has not connected, or the connection ran out |
| 422 `claimant_wallet` | the call carries the wallet of someone who filed a claim |

Each comes with a `fix` line the assistant can pass to the staff member.

## Known limits

- `get_run_results` clips output (4,000 characters of text per output, the first 10 rows of a SQL result). End a notebook with one
  compact JSON block of findings under that limit, then turn it into a report with `get_report_format` and `save_case_report`.
- The wallet check catches **wallets**, not names, statements or transaction hashes. The assistant is told not to send those, and
  nothing enforces it.
- The check is on the exact address text. A wallet split across strings, or encoded, would get through. It is a guard against
  mistakes, not against someone trying to get round it; the staff audit is the backstop.
- Sandworm tokens have no scopes and are not tied to a workspace, so a leaked refresh token is that person's full Sandworm login.
  They are sealed with AES-256-GCM and never leave the server, but keep `SANDWORM_TOKEN_KEY` out of logs and backups.
- The calls skip MCP's `initialize` because Sandworm's server is stateless (from its source). If a call fails with a protocol error,
  add the handshake in `sandwormRequest`.

## Files

- `apps/web/src/libs/sandworm/`: `Sandworm.ts` (discovery, tokens, one MCP request), `Connection.ts` (sealed tokens, refresh with a
  row lock), `Proxy.ts` (wallet check, workspace, audit), `Respond.ts` (answers).
- `apps/web/src/app/api/sandworm/connect` and `callback`: the sign-in. `apps/web/src/app/api/mcp/staff/sandworm/`: the two routes
  the MCP server calls.
- `apps/web/src/utils/`: `Seal.ts` (seal and unseal), `sandworm/Pkce.ts`, `sandworm/WalletScan.ts`.
- `apps/mcp/src/tools/staff.ts`: the two tools.
