# The case report: what Sandworm hands over and what the case bank shows

The case bank's **Preview** (and the "Analysis report" section on a case page) shows one frozen record per case: the findings of an analysis, written in Celia's house language. Sandworm produces the findings; staff check and save them; Celia stores them with a hash and draws them in its own design. See `case-submission-and-reports.md` §6 (option C) for why a frozen snapshot and not an iframe.

Sandworm's existing "Case #00x" notebooks (published-style write-ups of named companies) are the model for the shape, "They say, the chain says, a verdict", but they are not loaded into Celia: platform names stay anonymised in the case bank until the platform consents to being named.

## How a report gets into the app

1. Run the analysis. End it with one step that prints the findings below as a single JSON block, tests and their outputs included.
2. Staff open **Staff, Cases**, press **Add report** on the case, and paste the JSON.
3. The app checks the format and the house language, hashes the result (SHA-256 of its canonical JSON) and saves it as a new version. Older versions are kept.
4. A case can be moved to **Sealed** only once it has a report.

**The analysis lives inside Celia.** The report carries its own tests and their outputs, so a lawyer goes from a finding to the numbers behind it without leaving the app: the case page shows the summary, and **Open the full analysis** (`/dashboard/cases/<id>/analysis`) shows every test's output in a table, with the version history and each version's hash. There is no link out to another service. (Earlier drafts linked a Sandworm notebook; that field is gone.)

Nothing here calls an analysis service yet: someone pastes the JSON in. Producing it automatically, from analysis run inside Celia, is the next piece.

## The format (`apps/web/src/validations/ReportValidation.ts`)

```json
{
  "version": 1,
  "headline": "The chain shows 142 wallets sending funds to one address. It does not show intent.",
  "estimate": { "wallets": "142", "losses": "$310,000" },
  "figures": [{ "label": "Wallets affected", "value": "142", "note": "that sent funds to the platform" }],
  "checks": [
    {
      "claim": "Withdrawals are always available.",
      "evidence": "No withdrawal leaves the platform's address after 14 September.",
      "result": "proven",
      "tests": ["withdrawals-by-day"],
      "proof": [{ "label": "Transaction", "url": "https://explorer.example/tx/0x…" }]
    }
  ],
  "tests": [
    {
      "id": "withdrawals-by-day",
      "title": "Withdrawals by day",
      "summary": "Outgoing transfers fall to zero on 14 September and stay there.",
      "columns": ["Day", "Outgoing to users"],
      "rows": [["13 Sep", "19"], ["14 Sep", "0"]]
    }
  ],
  "method": {
    "commitment": "0x…64 hex characters, if the method was committed before the data was read",
    "notebookUrl": "https://… the published notebook the analysis was run in, if there is one"
  },
  "dataAsOf": "2026-10-27T10:00:00Z",
  "sources": ["Public chain data"]
}
```

- `result` is one of `proven` (the chain bears the statement out), `proven_false` (the chain shows the statement is false), `partly_proven`, `not_proven` (the chain does not settle it), `not_checkable`. Use `not_checkable` for what the chain cannot show (a bank transfer, a card payment, a promise made in chat). Never guess.
- Each check lists the `tests` (by `id`) that back it. The app rejects a check that names a test the report does not have, and two tests with the same `id`.
- **Every test carries a table**: 1 to 8 columns and 1 to 50 rows, every row as wide as the headings. The app refuses to save a report with a test that has none. Reports saved earlier still open, with a note where a test has no table.
- `proof` is optional and is for links **outside** Celia, such as one transaction on a block explorer: up to 5 per check, https only.
- Celia handles no payments, so figures never say "received" or "paid out" as if Celia did: say what was lost to the platform ("Estimated lost to this platform").
- `method.notebookUrl` is optional: the published notebook, https only. The full analysis page shows it as "Open the notebook" so a lawyer can check the method. It is a link, not the record: a published notebook can change when it re-runs, so the frozen findings stay the record. The notebook must be keyed to the platform and hold no claimant data.
- `estimate` is optional and holds the two numbers the case preview shows: wallets that sent funds to the platform and the total they sent, both read from the chain. It is never a claimant's own figure.
- Limits: 4 `figures`, 20 `checks`, 20 `tests`, 10 `sources`.
- The app rejects text with words Celia does not use: scam, scammer, fraud detected, guaranteed, recover your money, exposes. Say what is proven and not proven; a court decides intent.

## What must never be in it

Public facts only: the platform's addresses, the method, what the tests found, counts. **Never a claimant's name, wallet, statement or loss.** Everything a lawyer sees about a claimant lives only in Celia, after the lawyer takes the case.
