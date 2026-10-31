# Celia MCP: what it does (rough)

The MCP server lets an AI assistant (Claude and others) work with the case bank. Setup and routes are in `ops/mcp.md`; this note
is about what it is for.

## The idea

Celia verifies victims' claims with onchain evidence and offchain records. The work has two halves:

- **An agent researches.** It reads the case, runs the onchain analysis (for example in a Sandworm notebook) and drafts findings, each
  marked proven or not proven.
- **A person validates.** Someone at Celia reviews the findings and confirms every claim. The agent never confirms a claim and never
  decides what is proven.

The MCP is the door the agent uses. It shows each caller only what the case bank would show that person.

## Flow, claim to case

1. A victim sends a claim and proves the wallet is theirs. The claim stays alleged.
2. An agent and a person verify it. Staff confirm the claim ("Confirmed"; a signature alone is only "Wallet signed").
3. The first confirmed claim opens a case. Confirmed claims on the same platform pool into it. At 5 confirmed claims and an estimated
   loss of $1,000 the case starts building evidence. Staff set "enough evidence" once a report exists.
4. The case is the base case: the verified evidence that researchers, law firms, investigators and law enforcement start from to
   build their own credible cases. Celia holds no funds and runs no case.

## What each caller gets

| Caller | Can do |
|---|---|
| Anyone signed in | List cases, read a case, read its newest report |
| A person | Read their own claims and whether Celia confirmed them |
| A law firm | List the cases it leads, read the claims in them (kind of loss, wallet, transaction, amount, country, signed, confirmed). No names, no statements |
| Celia staff | See the queue counts and the claims waiting (no names, emails, wallets or proof files), and save a case report |

`research_case_claims` (staff) researches the platform of a case off the chain, from the hosts its confirmed claims name, and returns
evidence drafts: when the domain was registered (RDAP) and when the Internet Archive first saved the site, each with a link to open.
A draft is not evidence and nothing is saved. It becomes evidence when it is confirmed and added with `add_evidence`: a staff member
can confirm any draft; the agent may confirm a draft from this tool only after opening its link and checking it shows what the note
says, then records `review_evidence`. Both are audited `via: mcp`. The on-chain research belongs to the Sandworm analysis.

Saving a report is the only write. The tool tells the assistant to show the findings to the staff member first. The web app checks
the report with the same rules as the staff area (format, house language, a table for every test, a readable dollar loss), keeps
earlier versions and writes a staff audit row marked `via: mcp`.

## Reviewing claims at scale

The reason for the MCP: one person cannot read thousands of claims, but an agent can read all of them. The human still decides.

1. **The agent reads every waiting claim** (`list_claims_to_review`: platform, kind of loss, chain, amount, wallet proof, signals, no
   names or wallets) and skips the ones it already reviewed.
2. **The agent advises** (`review_claims`, up to 50 claims a call, repeated until the queue is done). For each claim it says whether
   it is worth a closer look and writes a short message: what it saw, why it flagged it or not, what it suggests. Flagged claims get
   their own tab for staff. This accepts and rejects nothing.
3. **The human approves** (`accept_claims` / `reject_claims`, up to 100 claims a call). Staff read the agent's messages, open the
   flagged ones, then accept or reject in bulk. Each change answers first with a summary and runs only after the staff member says
   yes to that exact change.

So the agent does the reading and the human does the deciding. A claim is confirmed only by a person, and the agent never decides
what is proven. The one thing an agent may confirm itself is an evidence draft from `research_case_claims` (a public registry or
archive record, checked against its link); that is not a claim and proves nothing about one.

## Rules that do not bend

- A claimant is named in research only by a label, `claimant_` and eight hex digits (for example `claimant_3fa9c21b`). It comes from a
  hash of the claim id, so the same claim always has the same label, staff can read it back to the claim, and nobody else can. It
  is in the claim listings and in the rule of every tool that writes text: review messages, statements, alleged actions, evidence
  and reports. Never a name, wallet, email, claim id or the claimant's own words.
- No claimant name, statement, email or proof file ever reaches an assistant. Wallets reach only the firm that leads the case.
- Reports hold public facts only and declare no fraud: they say what the chain shows and what it does not.
- The role picks the tools, and the web app checks the caller again on every request.

## Open questions

- Keep wallet addresses in the law firm's `get_case_claims`? They leave Celia for an assistant.
- Should an agent's report save as a draft that staff publish in the app, so the human review is enforced and not only asked for?
- Check the OAuth token's audience and scope in Clerk.
- Not yet tried against a live Clerk sign-in or a live Sandworm notebook.
