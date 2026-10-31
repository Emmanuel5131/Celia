# Case analysis on Sandworm: the contract

**Status:** design, revised after the Sandworm repo answered round 1 (2026-10-31; the log is at the end). **Built so far (Celia
side only):** the brief and preflight (`@celia/core`, `analysis.ts`), staff-entered platform statements, brief approval with its
commitment hash, the findings schema (`FindingsValidation`), and two read-only staff tools for the assistant (`get_analysis_brief`,
`get_analysis_contract`). **Not built:** the probe, the template notebook, the verification step, the compose step and chart
rendering. One test is still needed before section 7 is final (section 13, "the file test"). It settles what Celia asks Sandworm to do for a
case, what comes back, who writes what, and what stops a vague or oversized request from spending compute. Connection and sign-in
are already built (`docs/ops/sandworm.md`, `docs/integrators/celia-mcp.md`); this note is about the analysis itself.

**Written for:** the Celia developers, and Claude Code in the Sandworm repo (section 13 holds the open questions for it; answers go
into the log at the end).

## 1. Decisions this builds on

| Decision | Source |
|---|---|
| Celia staff run the analysis (an agent researches, a person validates). Organisations do not run the official one. | `docs/mcp.md`, the public-good decision |
| The report is a frozen snapshot that Celia renders itself. It is the record. | `docs/research/case-report-format.md` |
| The live Sandworm notebook is the "full" view, **a link** ("open the notebook"), labelled as not the record. Sandworm has no embed mode (Q6). | this note |
| The tests are a fixed template, forked per case. The agent sets the parameter cells only. | `docs/research/case-submission-and-reports.md` §5 |
| The template notebook is **public and listed**, because Sandworm forks only public notebooks (Q3). It holds no case data. | this note |
| One fork per run, published once and never republished. That is the only way to a link that does not change (Q5). | this note |
| The verdict of each check comes from the notebook, from thresholds fixed before the run. The assistant cannot change it. | this note |
| Celia's side writes the prose. Sandworm produces numbers, tables, charts and verdicts. | this note |
| Start with one template: the investment platform (Ponzi pattern). | this note |

## 2. The flow

```
case reaches "building evidence"
  -> 1 preflight        Celia checks the case is ready (section 4). Blocks if not.
  -> 2 probe            a cheap count on the platform's receiving address (section 5). Stops if empty or too big.
  -> 3 brief            Celia builds the analysis brief (section 3). Staff read it and press Run. This is the spend gate.
  -> 4 run              fork the public template into Celia's workspace, set the parameter cells with update_cell, run.
  -> 5 results          the notebook writes one findings file (section 7). The assistant reads it with read_file.
  -> 6 verify           Celia's web app, not the assistant, re-reads the notebook and the file and checks them (section 6).
  -> 7 compose          the assistant writes the sentences around the verified results, in house language (section 8).
  -> 8 review           staff read the report and approve it.
  -> 9 save             save_case_report: checked, hashed, saved as a new version, written to the staff audit.
```

Steps 1 to 3 and 6 to 9 are Celia's. Steps 4 and 5 are Sandworm's.

## 3. The analysis brief

A structured record, built by Celia from the case, never typed free-hand. It is stored with the run, so the saved report shows
exactly what was asked.

| Field | Comes from | Notes |
|---|---|---|
| `case` | `case.id`, `case.seq` as `CB-0142`, `case.name` | The case number, in lower case, also names the run's files (section 7). |
| `template` | chosen from the fraud type | `{ id, version }`, with the stored hash of each cell. See section 6. |
| `chains` | distinct `claim.chain` of the pooled, confirmed claims | Only chains notebooks can read (Q7, and the open check on Tron and Solana in section 13). Others are "statement only, not analysed". |
| `receivingAddresses` | `claim_address` rows with role `receiving`, and `claim.destinationAddress` | The platform's side. De-duplicated across claims. Staff confirm the list before a run. |
| `tokenContracts` | `claim.tokenContract` | Only when the template needs them. |
| `hosts` | `claim.platformHost` | Context for the reader. Not queried on chain. |
| `window` | start: the earliest confirmed payment (`txCheck.facts.at`). End: now. | A window is always set, never "all time". With no payment time (a chain Celia cannot look up), it starts as far back as the template reads (2 years) and the plan says so; the probe will narrow it. |
| `platformStatements` | **new, entered by staff** | 1 to 5 public statements the platform made, each with a source link. See below. |
| `budget` | template defaults | Max runs, max pages of transfers per address, time limit per run (section 11). |

**Platform statements are the missing input.** A check is "what the platform said" against "what the chain shows". Today nothing in
the case holds what the platform said, and the claimants' own words are private and must not be used. Each statement is
`{ text, sourceUrl, saidOn? }`, public and sourced, and is mapped to one or more tests by the template (for example, "withdrawals are
always available" maps to the withdrawals test). A statement the chain cannot show is kept and marked `not_checkable`, never guessed.

**Never in a brief:** a claimant's name, wallet (the `affected` role and `claim.walletAddress`), statement, email, or proof file.
`sandworm_call` already refuses a call that carries a claimant wallet; the brief builder should never produce one.

## 4. Preflight: when Celia refuses to start

These run in Celia, before anything reaches Sandworm.

| Rule | Blocks? |
|---|---|
| The case has enough confirmed claims (5, `confirmedClaimsToBuild`). **Not the $1,000 loss floor:** the case's estimated loss comes from the first report, so a floor on it would stop the first analysis from ever starting. | Yes |
| The case is not sealed | Yes |
| The fraud type has a template | Yes |
| At least one chain is one notebooks can read | Yes |
| At least one platform identifier (receiving address, token contract) that passes address validation for its chain | Yes |
| A window no longer than the template's maximum | Never blocks: a longer one is shortened, and a missing start becomes the maximum, each with a note |
| At least one platform statement, with a source link, mapped to a test | Yes |
| The run count for the case is under the cap | Yes |
| Receiving addresses were confirmed by staff | Yes |
| Statements that map to no test | Warns: they will be `not_checkable` |
| The last run for the case is older than a set age | Warns: say it is a re-run |

## 5. The probe: a cheap count before the full run

Per chain, for each receiving address and the window, ask only what is cheap (Q7):

- **How many transfers:** Blockscout's `/addresses/{address}/counters` (transaction and token-transfer counts). Available for
  Ethereum, Arbitrum and Base.
- **The first and last activity dates:** two `txlist` calls (Etherscan or Routescan), one sorted ascending and one descending, each
  with `offset=1`.
- **Not in the probe:** the number of distinct senders. There is no cheap way to get it; it needs paging through the transfers, so it
  is a test's job, not the probe's.

Stop and show staff the numbers when:

- there are **no** transfers (wrong address or wrong window);
- the transfer count is **above the template's page cap** (narrow the window or the addresses first). Etherscan allows about 3 calls
  a second, so a large address is slow and costly before it is useful.

The cap is open (section 14). The probe's numbers are saved in the brief, so staff approve with the real size in front of them. A
chain with no counters endpoint skips the count and shows only the dates.

## 6. The test template, and verifying a run

A template is a notebook Celia owns and signs off with counsel. It is written once, kept **public and listed**, and forked for
every run.

- **Fixed:** the test cells, the thresholds, the output shape, the verdict rules, the summary sentence templates.
- **Parameter cells only:** `input`, `dropdown_input` and `date_input` cells for the chains, addresses, contracts and window. Sandworm's
  `fork_notebook` takes no parameters, so after the fork the assistant sets them with `update_cell` (Q3).
- **Pinned:** the template's id and version, and Celia's own hash of the source of every test cell. Sandworm has no tool that returns
  cell hashes, but `get_notebook` returns every cell's source as text, so Celia can hash them itself.

**Verification is Celia's step, run by the web app with the staff member's own Sandworm login, never by the assistant.** After a
run it re-reads the notebook and checks that:

1. every cell that is not a parameter cell hashes to the stored template (a changed test cell refuses the run);
2. each parameter cell holds exactly the value in the brief;
3. the notebook came from the pinned template (open question: does `get_notebook` show the fork's source? section 13);
4. the attestation's `codeHash`, when there is one, equals the template's.

A run that fails any check is refused, and the failure is written to the staff audit.

Each **test** in a template declares:

| Part | What it is |
|---|---|
| `id`, `title` | Lowercase id (Celia's report uses `^[a-z\d-]{1,40}$`), and a short title |
| `question` | The question it answers, in a sentence |
| `backs` | The kinds of platform statement it can answer |
| `thresholds` | Numbers fixed in advance, with the reason for each |
| `output` | The table: column names, at most 8 columns, at most 50 rows |
| `verdict` | A plain rule from the numbers to `proven`, `proven_false`, `partly_proven`, `not_proven` or `not_checkable`. `proven_false` is about the statement only: the chain shows it is false, which says nothing about intent |
| `summary` | A sentence built from the numbers by code (an f-string), so the figures in the words cannot drift |
| `chart` | Optional: a small chart spec (section 7) |

### First template: investment platform (a proposal for counsel and Sandworm to sign off)

| Test | Question | Notes |
|---|---|---|
| `inflow-outflow` | How many wallets paid in, how much, how much came back out, and the net | Also gives the case `estimate`: wallets and total, with no claimant wallet needed |
| `withdrawals-by-day` | Do payouts per day stop at some point | The shape used in the report-format example |
| `concentration` | How much of the money depends on a few counterparties | Inflows and outflows separately |
| `payout-source` | Are payouts funded by later deposits rather than by income | The Ponzi pattern. Needs a careful, counsel-approved definition before it is built |

Other fraud types (rug pull, exchange freeze, impersonation) get their own templates later. A drained wallet with no operator to
name is out of scope for a template, as in the fraud-types note.

## 7. What a run writes: the output contract

`get_run_results` clips output (4,000 characters of text per output, 20 outputs per cell, the first 10 rows of a SQL result, and only
the title and trace names of a plotly figure). So results do not travel through printed output. **The notebook writes a file, and the
assistant reads it whole** (Q1, Q2):

- The last cell writes `./data/<case number>/run-<n>/findings.json` (`json.dump`), for example `./data/cb-0142/run-1/findings.json`.
  Files are named per case and per run, because the workspace is shared across notebooks.
- `read_file` returns a file whole, up to 256 KB per call, with a `nextOffset` for paging. It refuses binary files (it errors on a NUL
  byte), so charts are written as JSON, never as images.
- Printing a short summary to the cell output is still fine for a person reading the notebook. Celia does not read it.

**Not yet confirmed.** The file API and the notebook's kernel both work in the workspace's Jupyter directory, but no one has checked
that the kernel's working directory is the one `read_file` reads. Section 13 has the one-cell test. If it fails, the smallest change on
Sandworm's side is a `get_cell_output(notebookId, cellId, outputIndex, offset)` tool that pages one stored output in full.

```json
{
  "celia": 1,
  "run": {
    "templateId": "investment-platform",
    "templateVersion": "1.1.0",
    "notebookUrl": "https://…",
    "attestation": { "codeHash": "0x…", "inputHash": "0x…", "requestHash": "0x…", "requestTx": "0x…" },
    "dataAsOf": "2026-10-31T10:00:00Z"
  },
  "tests": [
    {
      "id": "withdrawals-by-day",
      "title": "Withdrawals by day",
      "summary": "Outgoing transfers fall to 0 on 14 Sep and stay there.",
      "verdict": "proven",
      "columns": ["Day", "Outgoing to users"],
      "rows": [["13 Sep", "19"], ["14 Sep", "0"]],
      "chart": {
        "type": "bar",
        "x": ["13 Sep", "14 Sep"],
        "series": [{ "name": "Outgoing to users", "values": [19, 0] }],
        "threshold": { "value": 1, "label": "Fixed threshold" }
      }
    }
  ]
}
```

- **The file is outside the notebook, so the attestation does not cover it.** The attested code produced it, and Celia hashes the
  findings itself and keeps the hash with the report version.
- A test may also write the full plotly figure (`fig.write_json("./data/<case number>/run-<n>/<testId>.json")`) for anyone who wants the
  live look. Celia's record uses the small `chart` spec, not the figure (section 9).

**How it maps onto the report Celia already stores** (`apps/web/src/validations/ReportValidation.ts`):

| Run output | Report field |
|---|---|
| a test | one entry of `tests` (`id`, `title`, `summary`, `columns`, `rows`) |
| the `verdict` of the test that backs a statement | that check's `result` |
| the `inflow-outflow` numbers | `estimate` (`wallets`, `losses`, `lossUsd`) and `figures` |
| Celia's pre-run commitment (section 10) | `method.commitment` |
| `run.attestation` | **no field today.** A small optional `method.attestation` is needed. |
| `run.notebookUrl` | `method.notebookUrl` |
| `run.dataAsOf` | `dataAsOf` |
| `chart` | **not stored today.** Celia has no chart component and no chart library. See section 9. |

The report's own limits apply to what the notebook writes: at most 8 columns, 50 rows, 20 tests, a summary of 600 characters, a table
cell of 120. The template should respect them, so nothing is cut on the way in.

## 8. Who writes what

| Part | Written by |
|---|---|
| Numbers, tables, chart data, the verdict, each test's one-line summary | the Sandworm template (code) |
| The report headline | the assistant, in house language, quoting the test summaries |
| Each check's `claim` (the platform's statement) | staff, from the brief's `platformStatements` |
| Each check's `evidence` sentence | the assistant, from the test summaries and numbers |
| Approval of the brief | staff |
| Approval of the report | staff |
| The house-language check, the hash, the version, the audit row | Celia's web app (`saveCheckedReport`) |

Why: the legal wording stays in one place, Celia's checks refuse the words it does not use, and Sandworm needs no legal rules.

**Enforced, not asked.** "The assistant may not change a number or a verdict" is only an instruction while the assistant submits
the whole report. Proposal: the save step takes the assistant's sentences plus a run id, and **Celia's web app reads the findings file
itself** (after verification, section 6) and takes `tests`, the verdicts and the numbers from it. The assistant's JSON can then only
carry the headline and each check's `evidence` wording. This is a decision for you (section 14).

## 9. Charts and the Celia colours (blue, not purple)

- **Plotly only, in notebooks**, so every live view looks the same. A notebook's charts take Celia's colours in code: the template
  notebook builds its own `go.layout.Template` and sets `pio.templates.default`, or passes colours explicitly (Q10). Colours set
  explicitly survive Sandworm's own display-time rewriting, which only fills values left unset.
- **The page around a published notebook stays purple.** Sandworm hard-codes its theme in the page, with no `theme` parameter and no
  embed to theme. That is accepted: the link is "open the notebook on Sandworm", which is Sandworm's own page.
- **The record does not depend on a Sandworm chart.** Celia draws the `chart` spec itself, with its own tokens, once a chart library
  is picked. The alternative is to store plotly's figure JSON and render it with plotly.js, which is heavy and harder to restyle; the
  small spec is the recommendation. Until a chart exists in Celia, the table is the record.
- **Colours.** Celia's navy family, defined in `apps/web/src/styles/global.css` and `docs/DESIGN.md` §2 and §7:

| Use | Light | Dark |
|---|---|---|
| Series 1 (`--chart-1`) | `#0F1B2D` | `#E8EDF5` |
| Series 2 (`--chart-2`) | `#46566E` | `#9FADC2` |
| Series 3 (`--chart-3`) | `#7F8DA3` | `#6B7A92` |
| Series 4 (`--chart-4`) | `#B9C2D0` | `#2A3A56` |
| The finding: a threshold or an overstated bar (`--chart-5`, seal) | `#991F38` | `#E0687C` |
| Background | white `#FFFFFF`, or paper `#F5F2EA` | deep navy |
| Gridlines | ink at 5 to 12 percent, hairline | light at the same strength |
| Axis labels | mono, 12px, ink at 55 percent | the same |

- **Rules from §7:** ink only plus one accent; seal red marks the finding, never a series; no gradients; label the key number on the
  chart; show proven or not proven next to a chart that backs a finding. No purple in anything Celia draws.
- **Decision for you:** these tokens are navy and slate, and series 2 to 4 are quiet. If three or more series need to read as
  distinctly blue, choose a sequential blue ramp with your designer, then change `--chart-*` in `global.css`, so the app and the
  template notebook take the same values. I have not invented any new colour here.

## 10. Review gates, commitment and the audit

Two human steps, each recorded in the staff audit (proposed actions in brackets):

1. **Approve the brief** before a run (`analysis_brief_approved`). The brief shows the probe's size and the platform statements.
2. **Approve the report** before it is saved. This is the same step as today's `save_case_report`, which already writes `report_saved`.

Every call to Sandworm is already recorded as `sandworm_called`, with the tool name and never the contents. A failed verification
(section 6) is recorded too (`analysis_run_refused`).

**The commitment.** Sandworm's attestation can only be made after a run and cannot take a hash from outside (Q4). So Celia makes the
"method before data" proof itself: it hashes the brief and the template pin (version and cell hashes) and stores the hash with a
timestamp **before** the run starts. That is `method.commitment`. Anchoring it onchain waits for the sealing work (who holds the key is
still open). Sandworm's attestation (`codeHash`, `inputHash`, `requestHash`, `requestTx`) is kept as a second, independent proof.

## 11. Cost control

Sandworm gives no help here (Q8): a run carries no compute or credit figure, and there is no per-run row or time limit to set. What
exists is fixed: 300 seconds per cell, 200 cells per run, a 45-second wait per tool call. The real cost is third-party: Nansen credits
and Etherscan's 3 calls a second (Dune needs its Pro plan, and Sandworm Cloud a paid plan, at the platform level).

So the limits live in Celia and in the template:

- **In the template code:** a page cap on transfers per address, a hard stop on total calls, and a window no longer than the template
  allows. This is how "too many" (section 5) is enforced, not by Sandworm.
- **In Celia:** a cap on runs per case, and a record of each run's wall time and the number of Sandworm calls (from `staff_audit`).
  Credits used at Nansen and Etherscan are read from those providers' dashboards.
- Cases are chosen for a full run from a published queue ranked by objective criteria, not by who asks or who pays (the public-good
  decision). A firm's interest is never the trigger.

## 12. Privacy

- The public method notebook is keyed to the **platform**, never to the victims. Attested code is pinned publicly for good.
- The headline numbers (wallets that paid in, the total) come from the platform's receiving addresses, so they need no claimant wallet.
- **Private mode exists (Q9).** A notebook is visible to its workspace by default, and nothing becomes public unless someone publishes
  or attests it. Two leaks remain even in a private notebook: the MCP call log saves tool arguments and results to a chat on the
  notebook, readable by workspace members; and the notebook runs on Sandworm's infrastructure, so a data-processing agreement would
  still apply. A third sits on Celia's side: whatever a tool returns goes to the model provider the assistant runs on.
- **Per-victim loss is still unresolved.** It is possible technically, but it would mean claimant wallets in a notebook, in its call
  log and in a model's context, and `sandworm_call` refuses them today. Until you decide, the report holds no per-victim figures.

## 13. Open questions

### The file test (needed before section 7 is final)

One cell writes `json.dump({"ok": True}, open("./data/case-test/findings.json", "w"))`, then `read_file` reads that path back. If it
returns the content, questions 1 and 2 need no change on Sandworm's side. Best done through Celia's own `sandworm_call`, because
that tests the exact path we will use (the workspace set by Celia, the wallet check, the audit). The Sandworm repo can give the four
payloads to paste (tool name and arguments for `create_notebook`, `add_cell`, `run_notebook` and `read_file`).

### For the Sandworm repo (round 2)

11. **Fork source.** Does `get_notebook` show which notebook a fork came from, so Celia can check it was forked from the pinned template?
12. **Parameter cells.** Does `get_notebook` return the current value of `input`, `dropdown_input` and `date_input` cells separately
    from their source, so Celia can check them against the brief?
13. **Private template.** `duplicateDocument` exists in GraphQL but has no MCP tool. Could a tool expose it, so the template need not
    be public?
14. **Chain coverage, exactly.** Is Tron covered, and Solana? Many scam payments are Tron USDT. Please give the list of chains a
    notebook can read today, with the source for each (open data, Etherscan V2, Nansen).
15. **`get_cell_output`** only if the file test fails.

### Round 1 (answered, see the log)

1. Output beyond the clipping limit. 2. Plotly figure data. 3. Parameters and cell hashes for a fork. 4. Attestation before a run.
5. An immutable run link. 6. Embedding. 7. Chain coverage and a cheap probe. 8. Cost. 9. Private mode. 10. Theme.

## 14. Open decisions for Celia

1. **The page cap and the run cap**, per template. They replace the probe limit that depended on Sandworm's cost.
2. **Counsel signs off the first template**, in particular the definition of `payout-source`, and the thresholds with their reasons.
3. **A chart library** for Celia's own rendering (the recommendation is a small spec, drawn with Celia's tokens), and whether
   `--chart-*` gets a more distinctly blue ramp (section 9).
4. **A public template** (a Sandworm fork requirement, Q3). Acceptable, since the method is public and holds no case data, unless
   question 13 gives another way.
5. **Whether the web app reads the findings itself** and the assistant only adds sentences (section 8). I recommend it.
6. **A `method.attestation` field** in the report, and where the brief and its approval are stored (a table).
7. **Who approves a brief**, if it should be a second person for the first cases.
8. **The per-victim loss approach** (section 12).
9. **Which chains count as "supported"** once question 14 is answered, against the 55 chains the claim form accepts.

## 15. Build order

0. **The file test** (section 13). Nothing else depends on Sandworm until it passes.
1. **Done:** the brief builder and preflight (`packages/core/src/analysis.ts`), the platform-statement input and the approval gate
   (Staff, Cases, Open brief), the commitment hash, and the findings schema with the two staff tools.
2. The probe, through `sandworm_call`.
3. The template notebook for the investment platform, with the findings file and Celia's colours, in the Sandworm repo.
4. The verification step in the web app (section 6), and the commitment (section 10).
5. The compose step: a staff-only tool that reads the verified findings and `get_report_format`, and drafts the sentences.
6. Rendering charts in Celia, once a library is chosen.

## Answers log

Round 1, from the Sandworm repo, 2026-10-31. Read from the code; **none of it was run**.

| Q | Answer | Effect on this design |
|---|---|---|
| 1 | A Python cell can write a file under `./data/`; `read_file` returns it whole (up to 256 KB, with `nextOffset`). Unconfirmed that the kernel's directory is the one the file API reads. Fallback: a `get_cell_output` tool. | Results travel through a findings file (section 7). The file test is step 0. |
| 2 | Yes, through the same path: `fig.write_json(...)` then `read_file`. `get_run_results` gives only the title and trace names. Images are never returned, and `read_file` refuses binary files. | Charts are JSON, never images. Celia renders a small spec itself (section 9). |
| 3 | `fork_notebook` takes only a source and a target workspace, no parameters. Set them with `update_cell` on `input`, `dropdown_input` and `date_input` cells. Forking needs a **public** source; unlisted notebooks are never forkable. No tool returns cell hashes, but `get_notebook` returns every cell's source. Correction to the earlier audit: "published" was not enough. | The template is public and listed. Celia hashes the cells itself (section 6). |
| 4 | Unchanged: attestation needs a recorded run time and cannot take an outside hash. It exposes `codeHash`, `inputHash`, `requestHash` and `requestTx`. | Celia makes the pre-run commitment itself (section 10). |
| 5 | No run-level permalink and no versions. Publishing stores a snapshot, and republishing overwrites it. | One fork per run, published once. The Celia snapshot is the only immutable record. |
| 6 | No embed mode. The live headers have only a report-only `frame-ancestors 'self'` and no `X-Frame-Options`, so framing is not blocked today, but only by accident. An enforced allowlist would be new work. | A link only. No iframe is planned. |
| 7 | Reads Ethereum, Arbitrum, Base, Optimism, Avalanche, Bitcoin and Hyperliquid, other EVM chains through Etherscan V2, and 25+ through Nansen (a partial read of the code). Cheap count: Blockscout `/addresses/{address}/counters` (Ethereum, Arbitrum, Base). First and last dates: two `txlist` calls with `offset=1`. No cheap distinct-senders count. | The probe uses counts and dates only (section 5). Tron and Solana are not named, so question 14. |
| 8 | A run carries no compute or credit figure. Fixed limits: 300 seconds per cell, 200 cells per run, 45 seconds per tool call. No per-run row or time limit can be set. Real cost is third-party (Nansen credits, Etherscan 3 calls a second). Dune needs Pro, and Sandworm Cloud a paid plan. | Cost limits live in Celia and in the template (section 11). |
| 9 | Yes. Workspace visibility is the default, and nothing is public unless published or attested. Leaks remain: the MCP call log is saved to a chat on the notebook, and runs happen on Sandworm's infrastructure. | Per-victim loss is possible but deferred (section 12). |
| 10 | Charts: yes, in notebook code with no Sandworm change; explicit colours survive the display rewrite. The page's purple is hard-coded, with no theme parameter and no embed. | Charts take Celia's colours in code; the page stays purple (section 9). |

## One statement, one analysis

A case is a group of analyses, one for each statement the platform made. Each has its own approved plan (and commitment), its own
notebook and its own report; the report holds exactly one check, and `method.commitment` names the plan it ran, which is how Celia
finds the statement it answers. A statement is planned with only the tests that can answer it. `get_analysis_brief` lists the plans
waiting for a report and takes a `run` when more than one waits. Versions of a report are counted for each analysis.
