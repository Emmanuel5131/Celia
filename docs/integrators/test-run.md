# Test run: a real case, end to end

The goal is to see the whole path work once, on real chain data: Celia plans an analysis, an assistant runs it on Sandworm through
Celia's MCP, the notebook writes a findings file, Celia checks it, and a report is saved. Nothing here uses a model credit other than
the assistant you already use (Claude Code), and nothing is sent anywhere that is not already part of the build.

## The test case

**Forsage SmartWay** (case `CB-1001`): an early Forsage contract on Ethereum, `0xbfdbD665A11c60B6465Ec687e23241fC74bfC2fa`. It is a
verified contract named `SmartWayForsage`, deployed 2020-01-20 by the same deployer as the main Forsage contract, with 116 transactions
in all, so one run reads all of it. Forsage is the subject of **SEC v. Okhotnikov et al., 1:22-cv-03978 (N.D. Ill.)**; the complaint
(Document 1) is public and its allegations are the SEC's, not Celia's. The complaint gives no contract addresses, so the address
was identified on-chain by its verified name and deployer. The six claimants in the local database are **synthetic**
(`seed_user_forsage_*`): nobody's real claim belongs in a test.

Two statements are already entered, each quoted from the complaint with its source:

| Kind | What was said (as quoted by the SEC) |
|---|---|
| That withdrawals are available | "Here everyone decides for themselves when to withdraw, hold, no hold, and so on." |
| Something else (not checked) | "Forsage does not accumulate funds; its balance is always zero." |

The second is on purpose: it claims the opposite of what the tests ask ("does the contract hold the funds it receives?"), so this
version leaves it not checkable, and the run should show that.

## Before you start

- The web app runs (`pnpm run dev`) and the Celia MCP server runs (`pnpm run dev:mcp`, port 6790). Both are up now.
- **Staff, Sandworm** says Connected. If not, press Connect Sandworm.
- Seed the case again at any time (safe to repeat): `cd apps/web && pnpm exec dotenv -c -- tsx scripts/seed/forsage-case.ts`.

## 1. Plan the analysis (you)

1. Sign in as staff (`staff+clerk_test@example.com`, code `424242`) and open the case:
   `http://localhost:3000/dashboard/staff/cases/fcbf3216-e703-4776-8673-c327aca382ea`
2. You should see **Plan the analysis**, the two statements, and **What the agent will look at**: method `investment-platform 1.1.0`,
   dates **2020-01-20 → 2020-02-20**, one address, four checks. A note says one statement has no test.
3. Press **Approve plan**. The page changes to **Plan approved** and shows the sentence for your assistant.

## 2. Connect Claude Code to Celia's MCP (this repo)

`.mcp.json` at the repo root already names the server. In this repo, start `claude`, approve the project server `celia`, then run
`/mcp`, pick **celia**, and choose **Authenticate**. A browser opens: sign in as the staff user, press **Allow** on Clerk's consent
screen. `/mcp` should then list Celia's tools, including `get_analysis_brief`, `get_analysis_contract`, `sandworm_list_tools` and
`sandworm_call`.

## 3. Probe Sandworm first (cheap, and it settles two unknowns)

Two things are not confirmed yet: whether a Sandworm Python cell can reach a public chain API, and whether a file it writes can be
read back with `read_file`. Give your assistant this:

> Use Celia's `sandworm_list_tools`, then `sandworm_call`. Create a private notebook called "celia probe" with one Python cell that
> (1) calls https://eth.blockscout.com/api?module=block&action=getblocknobytime&timestamp=1579478400&closest=before with
> `urllib.request` and prints the status and the first 200 bytes, (2) creates ./data/cb-1001 and writes {"ok": true} to
> ./data/cb-1001/probe.json, and (3) prints `os.getcwd()`. Run it, then `read_file` ./data/cb-1001/probe.json and show me everything
> each step returned. Do not put any wallet address that belongs to a claimant in the notebook.

**Pass:** the API call prints `200` with a block number (`9314961`), and `read_file` returns `{"ok": true}`.
**If the API call fails:** the sandbox has no outside access. Tell me; the template then needs `SOURCE = 'etherscan'`.
**If `read_file` cannot find the file:** copy the `getcwd` line and the folder `list_files` shows; that is the working-directory problem.

## 4. Run the template (the agent)

Copy the sentence from the case page, or use this:

> Run the approved analysis plan for case CB-1001 (id fcbf3216-e703-4776-8673-c327aca382ea). Read `get_analysis_brief` and
> `get_analysis_contract` first. Build the notebook from `docs/integrators/template/investment_platform.py`: each `# %%` section is
> a cell, and the PARAMETERS section becomes input cells with the brief's values (CASE_NUMBER `cb-1001`, RUN `1`, CHAIN `ethereum`,
> ADDRESSES, WINDOW_FROM, WINDOW_TO). Do not edit any other cell. Run it, then `read_file` ./data/cb-1001/run-1/findings.json. Show
> me the findings before you do anything else.

## 5. Check what came back

Save the findings the assistant shows into a file and check it against Celia's contract (this also refuses a wallet address):

```bash
cd apps/web
pnpm exec dotenv -c -- tsx scripts/check-findings.ts <path to the findings.json>
```

Compare with the reference, computed independently from the same chain data
(`docs/integrators/template/reference/forsage-smartway.findings.json`). They should agree:

| Test | Verdict | What it shows |
|---|---|---|
| inflow-outflow | not proven | 30 wallets paid in 92 times, 6.25 ETH. 119 payouts to 14 wallets, 6.05 ETH. The contract kept 3.2%. |
| withdrawals-by-day | proven | One day, 2020-01-20: 92 payments in, 119 payouts. |
| concentration | not proven | Largest recipient 52.1% of payouts, top five 90.5%. Largest payer 12.0%, top five 34.4%. |
| payout-source | not checkable | Not built in this version. |

A difference is the interesting result. Send me both files and the cell output.

## 6. Compose and save the report (agent, then you)

> Read `get_report_format`. Write the report for case CB-1001 from the verified findings, in Celia's house language: take every
> number and verdict from the findings, change none, and write only the headline and each check's evidence sentence. Show me the report
> and save it with `save_case_report` only after I approve.

A finished example is `docs/integrators/template/reference/forsage-smartway.report.json` (it passes the app's report rules; it has
no `estimate` because ETH is not priced yet, and a report's estimate must read as dollars). Approve in the chat, then reload the case
page: it should say **Report saved**, with two checks (one proven, one not checkable) and a link to the full analysis.

## If something fails

Send me: the step, what the assistant returned, and (for steps 3 to 5) the cell output. The likely failure points, in order:

1. **Authenticate does not finish** (step 2): the Clerk consent screen or the `resource` check. Tell me the browser's last address.
2. **`sandworm_call` says not connected or not set up**: Staff, Sandworm must say Connected, and `.env.local` must have the three
   Sandworm settings.
3. **The probe cannot reach the chain API or read the file** (step 3): the two open questions above.
4. **The template fails or the numbers differ** (steps 4 and 5): paste the traceback or both findings files.
5. **`save_case_report` is refused** (step 6): Celia's message says what to fix; paste it.

## Known limits of this test

Native ETH only, so a platform paid in tokens would show nothing. No dollar value, so the case's estimated loss is not set. The window
is one month after the last claimed payment. The platform's own transfers between its addresses are left out, and wallets of people who
paid in or were paid out never appear in the findings, only counts and shares.
