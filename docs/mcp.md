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

Saving a report is the only write. The tool tells the assistant to show the findings to the staff member first. The web app checks
the report with the same rules as the staff area (format, house language, a table for every test, a readable dollar loss), keeps
earlier versions and writes a staff audit row marked `via: mcp`.

## Rules that do not bend

- No claimant name, statement, email or proof file ever reaches an assistant. Wallets reach only the firm that leads the case.
- Reports hold public facts only and declare no fraud: they say what the chain shows and what it does not.
- The role picks the tools, and the web app checks the caller again on every request.

## Open questions

- Keep wallet addresses in the law firm's `get_case_claims`? They leave Celia for an assistant.
- Should an agent's report save as a draft that staff publish in the app, so the human review is enforced and not only asked for?
- Check the OAuth token's audience and scope in Clerk.
- Not yet tried against a live Clerk sign-in or a live Sandworm notebook.
