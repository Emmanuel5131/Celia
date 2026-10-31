# Staff area

The staff area (`/dashboard/staff`) is where Celia's own team confirms lawyers and wallets, validates claims, opens and seals cases, saves reports and watches mail. **All research and analysis is done by staff.** Claimants and lawyers never run it, and nothing in the area is shown to them.

## Who can get in

Staff sign in through Clerk, at `/staff/sign-in` (a staff-only door with no sign-up). Three things must all be true, checked on the server for every staff page and every staff action (`requireStaff`):

1. The Clerk account has `publicMetadata.staff: true`. Set it by hand in the Clerk dashboard (or a script run by us). No form in the app can set it.
2. The account's **verified primary email is on the Celia domain** (`STAFF_EMAIL_DOMAIN`, such as `celia.example`) or is listed in `STAFF_EMAILS` for the rare exception. With neither setting, in production, **nobody** gets in.
3. In production the account has **two-step sign-in on**. Staff without it are sent to `/dashboard/staff/secure` to turn it on.

There is no shared username or password: each person signs in as themselves, so the activity log names who did what.

Anyone else gets a 404, so the area does not show that it exists, and the sidebar link only shows for people who can use it. In development the domain, the list and the two-step check are optional; once `STAFF_EMAIL_DOMAIN` or `STAFF_EMAILS` is set, it applies there too.

## Adding someone

1. In Clerk, give the user `publicMetadata`: `{ "accountType": "person", "staff": true }` (staff still have an account type of their own).
2. Give them an email on the Celia domain (or add the address to `STAFF_EMAILS`).
3. They sign in, turn on two-step sign-in when asked, and the area opens.

## Removing someone

Remove `staff` from their Clerk metadata and revoke their sessions in Clerk, and close their Celia mailbox.

## What is recorded

Every action in the area writes a row to `staff_audit` in the same transaction as the change: who (id and email at the time), what, which thing, when. The app only ever adds rows. The latest 100 show at the bottom of the staff page. Rows hold ids and short codes, never a claim or an email address someone was allowed.

## Settings to check before launch

- `STAFF_EMAIL_DOMAIN` (or `STAFF_EMAILS`) is set in production.
- In Clerk, require two-step sign-in for the instance or the staff organisation, and turn off sign-up methods that are not used.
- Responses under `/dashboard/staff` carry `Cache-Control: no-store`, `X-Frame-Options: DENY` and `X-Robots-Tag: noindex, nofollow` (see `next.config.ts`).

## Reviewing applications

Professionals and institutions apply through `/join` and onboarding. Each application appears in the staff page under "Applications to review", oldest first, with a review date shown to the applicant (five working days). Tick the six checks against public records, mark it ready for approval, and a different staff member approves it (in development one person can do both). Rejecting needs a reason, which the applicant sees. Every step is in the staff activity log. A lawyer whose jurisdictions change is sent back through review the same way.

## Settings for applications

| Setting | What it does |
|---|---|
| `INSTITUTION_PRICE` | The fee as shown to applicants on `/join` and in onboarding, such as `€1,200 a year`. The fee is invoiced outside the app, after approval. |
| `OPENCORPORATES_API_TOKEN` | Company registry lookup. Without it the lookup shows "Not set up". |
| `OPENSANCTIONS_API_KEY` | Sanctions lookup. Without it the lookup shows "Not set up". |

Approving an application opens access straight away; send the invoice yourself. A lookup is a reading aid: staff still tick each check, because names collide and registries lag.

## Cases and their analysis

**Staff, Cases** lists every case with one status and one button. The status says what is next:

| Status | Meaning | What staff do |
|---|---|---|
| Needs a plan | No statement has a plan yet | Open the case and pick a statement |
| Waiting for the agent | A plan was approved and no report followed | Give the assistant the sentence on that statement's page |
| Report saved | Every planned statement has a report | Review them, or plan another statement |

**Each statement of the platform is its own analysis.** A case has a group of them, and together they show what the chain shows. A
statement has its own plan, its own notebook, its own report (with its own versions) and its own page; nothing is shared. Lawyers see
the group as a list (`/dashboard/cases/<id>/analysis`) and open each report on its own page (`.../analysis/<run>`). A statement nobody
has researched yet shows "Not researched yet", not a verdict: it is up to staff and the assistant to start it. A statement no test
can answer (a topic of "something else") shows "Not on chain" and has nothing to run.

**The case page** (`/dashboard/staff/cases/<id>`) lists the statements with where each stands, and a form to add one (1 to 5 public
statements, each with a link and a topic staff choose, never guessed). Opening a statement (`.../research/<statement id>`) is where
staff plan and approve its research, then, once the assistant has run it, review its report. Everything after approval is the
assistant's work, run through Celia's MCP tools, and it saves a report only after the staff member agrees in the chat.

- A case that is not ready (too few confirmed claims, no test template, sealed, or no readable chain) shows why and no form, because
  those are not things staff can fix on the page.
- **Who is behind the platform** is optional notes on who claimants allege runs it, shown to lawyers as alleged. The agent does not
  need them.
- **Add a report by hand** is for when the assistant is not used: paste the findings JSON. It is folded away on purpose.
- Approving a plan is a person's step only. No tool the assistant has can do it, and it is written to the staff activity.
