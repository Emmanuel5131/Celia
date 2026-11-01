import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { WebClient } from '../web.ts';
import { handle } from './shared.ts';

const confirmation =
  'It changes nothing on the first call: it answers with a summary of what it would do. Show that summary to the staff member, and call again with confirmed: true only after they say yes to that exact change.';

const confirmed = z
  .boolean()
  .optional()
  .describe(
    'Leave out on the first call. Set to true only after the staff member has said yes to the summary.',
  );

const caseId = z.uuid().describe('The case id from list_cases');
const claimIds = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .describe('The claim ids from list_claims_to_review');
const note = z.string().min(1).max(500);

/** The one rule for naming a claimant in anything the assistant writes. */
const claimantRule =
  'Name a claimant only by their label, such as claimant_3fa9c21b, which the claim listings give. Never write a name, a wallet, an email, a claim id or any of their own words.';

/** Every change the staff area can make, as a tool: its name, what it does, and what it needs. */
const changes: {
  name: string;
  description: string;
  shape: z.ZodRawShape;
  destructive?: boolean;
}[] = [
  {
    name: 'add_alleged_action',
    description:
        `Add an alleged action to a case: something the claimants allege was done, such as a public statement, taking deposits or stopping withdrawals. Describe what is alleged and never declare fraud. ${claimantRule}`,
    shape: {
      caseId,
      title: z.string().min(1).max(200).describe('What was done'),
      kind: z
        .string()
        .max(80)
        .optional()
        .describe(
          'The kind of action in plain words, or one of: statement, deposits, withdrawals, funds_moved, promotion',
        ),
      occurredOn: z.iso.date().optional().describe('The day it happened, as 2026-09-14'),
      jurisdiction: z.string().optional().describe('A jurisdiction id'),
      note: z.string().max(1000).optional(),
    },
  },
  {
    name: 'update_alleged_action',
    description:
      'Change an alleged action of a case. Send every field you want to keep, because anything left out is cleared. Read the current values with get_case_lists first.',
    shape: {
      caseId,
      actionId: z.uuid().describe('The action id from get_case_lists'),
      title: z.string().min(1).max(200),
      kind: z.string().max(80).optional(),
      occurredOn: z.iso.date().optional(),
      jurisdiction: z.string().optional(),
      note: z.string().max(1000).optional(),
    },
  },
  {
    name: 'update_alleged_actor',
    description:
      'Change an alleged actor of a case, by its place in the list from get_case_lists. Send every field you want to keep, because anything left out is cleared.',
    shape: {
      caseId,
      index: z.number().int().min(0),
      name: z.string().min(1).max(120),
      role: z.enum(['runs', 'promotes', 'money', 'developer', 'hacker', 'other']).optional(),
      roleNote: z.string().max(80).optional(),
      jurisdiction: z.string().optional(),
      notes: z.string().max(1000).optional(),
    },
  },
  {
    name: 'update_statement',
    description:
      'Change a statement of a case. Only a statement nobody has planned research for can change.',
    shape: {
      caseId,
      statementId: z.uuid().describe('The statement id from get_case_lists'),
      text: z.string().min(1).max(500),
      sourceUrl: z.url(),
      kind: z.enum(['withdrawals', 'returns', 'reserves', 'history', 'other']),
    },
  },
  {
    name: 'update_evidence',
    description:
      'Change the details of evidence on a case: title, note, link, date, chain and reference, and the statement and action it backs. Its kind and its file cannot change: send the same type it has, and send every field you want to keep, because anything left out is cleared.',
    shape: {
      caseId,
      evidenceId: z.uuid().describe('The evidence id from get_case_lists'),
      type: z.enum([
        'link',
        'wallet',
        'transaction',
        'notebook',
        'chat',
        'script',
        'video',
        'image',
        'document',
      ]),
      title: z.string().min(1).max(120),
      note: z.string().max(500).optional(),
      sourceUrl: z.url().optional(),
      capturedOn: z.iso.date().optional(),
      chain: z.string().optional(),
      reference: z.string().optional(),
      statementId: z.uuid().optional(),
      actionId: z.uuid().optional(),
    },
  },
  {
    name: 'review_evidence',
    description:
      'Record the review of a piece of off-chain evidence (a video, picture, document or link): reviewed, or unverified when its source could not be checked, with a note on what it shows. Describe what it shows and never say it proves anything. On-chain evidence has no review.',
    shape: {
      caseId,
      evidenceId: z.uuid().describe('The evidence id from get_case_lists'),
      state: z.enum(['not_reviewed', 'reviewed', 'unverified']),
      note: z.string().max(500).optional(),
    },
  },
  {
    name: 'remove_alleged_action',
    description: 'Remove an alleged action from a case. Evidence attached to it stays on the case.',
    shape: { caseId, actionId: z.uuid().describe('The action id from get_case_lists') },
    destructive: true,
  },
  {
    name: 'add_alleged_actor',
    description:
      'Add a person, group or account the claimants allege was involved: someone who ran or promoted a platform, handled the money, built it, or carried out a hack. Put what is known about them (aliases, handles, wallets, links) in notes. The role other needs roleNote.',
    shape: {
      caseId,
      name: z.string().min(1).max(120),
      role: z.enum(['runs', 'promotes', 'money', 'developer', 'hacker', 'other']).optional(),
      roleNote: z
        .string()
        .max(80)
        .optional()
        .describe('What other means; required when the role is other'),
      jurisdiction: z.string().optional().describe('A jurisdiction id'),
      notes: z.string().max(1000).optional(),
    },
  },
  {
    name: 'remove_alleged_actor',
    description:
      'Remove an alleged actor from a case, by its place in the list from get_case_lists.',
    shape: { caseId, index: z.number().int().min(0) },
    destructive: true,
  },
  {
    name: 'add_statement',
    description:
        `Add a public statement the platform made to a case, with where it said it. Each statement is researched on its own. ${claimantRule}`,
    shape: {
      caseId,
      text: z.string().min(1).max(500).describe('What the platform said, quoted'),
      sourceUrl: z.url().describe('An https link to where it said it'),
      kind: z
        .enum(['withdrawals', 'returns', 'reserves', 'history', 'other'])
        .describe('The topic, which decides the tests'),
    },
  },
  {
    name: 'remove_statement',
    description: 'Remove a statement nobody has researched yet from a case.',
    shape: { caseId, statementId: z.uuid().describe('The statement id from get_case_lists') },
    destructive: true,
  },
  {
    name: 'add_evidence',
    description:
        `Add evidence to a case: a link to a page or post, a wallet or transaction (with its chain), a Sandworm notebook, Sandworm chat or script (a link), or a video, image or document (a file uploaded first with start_evidence_upload). Public material only, never a claimant. Set lawful to true only when the staff member confirms the material is public and lawful to show. ${claimantRule}`,
    shape: {
      caseId,
      type: z.enum([
        'link',
        'wallet',
        'transaction',
        'notebook',
        'chat',
        'script',
        'video',
        'image',
        'document',
      ]),
      title: z.string().min(1).max(120),
      note: z.string().max(500).optional(),
      sourceUrl: z
        .url()
        .optional()
        .describe('An https link; required for a link, notebook, chat or script'),
      pinId: z
        .string()
        .max(128)
        .optional()
        .describe(
          'Required for a video, image or document: the file id the upload address from start_evidence_upload returned',
        ),
      capturedOn: z.iso.date().optional(),
      chain: z.string().optional().describe('The chain, for a wallet or transaction'),
      reference: z.string().optional().describe('The address or transaction hash'),
      statementId: z.uuid().optional().describe('A statement it backs'),
      actionId: z.uuid().optional().describe('An alleged action it backs'),
      lawful: z.literal(true),
    },
  },
  {
    name: 'remove_evidence',
    description: 'Remove evidence from a case and stop pinning its file.',
    shape: { caseId, evidenceId: z.uuid().describe('The evidence id from get_case_lists') },
    destructive: true,
  },
  {
    name: 'approve_analysis_brief',
    description:
      'Approve the research plan for one statement of a case: the decision to spend the compute. Read it with get_analysis_brief first, and approve only the plan the staff member has looked at.',
    shape: { caseId, statementId: z.uuid().describe('The statement to research') },
  },
  {
    name: 'set_case_stage',
    description:
      'Move a case between collecting, building and sealed. Sealing needs a saved report and tells claimants and verified lawyers. Moving a sealed case back lets it be analysed again.',
    shape: { caseId, status: z.enum(['collecting', 'building', 'sealed']) },
  },
  {
    name: 'start_claim_reviews',
    description: 'Start the review of sent claims. Each person is told their claim is in review.',
    shape: { claimIds },
  },
  {
    name: 'accept_claims',
    description:
      'Accept sent claims. Each person is told, the claim joins the case for its platform, and any wallet proof they added is marked as checked. A claim for a wallet another account has proved is skipped.',
    shape: { claimIds },
  },
  {
    name: 'reject_claims',
    description: 'Reject sent claims with one reason, which each person sees.',
    shape: { claimIds, note },
    destructive: true,
  },
  {
    name: 'triage_claims',
    description:
      'Turn down the waiting claims whose evidence is bad: an address that is not valid for its chain, a video link that is not a link or did not open, or no wallet signature, file or video and no wallet activity on the chain. A claim with a signature, a file, a video that opens or a wallet that has been used is kept, and a claim staff already started reviewing is never touched. Each person is told and sees the reason for their group, unless you give another in note. The claims that stay are the ones to read with list_claims_to_review and review_claims, and to write a message for when worth a look. It works through the queue a piece at a time and rejects as it goes, so a cut-off loses nothing. If the answer says some are left, ask the staff member and call again with skip set to nextSkip, until none are left.',
    shape: {
      note: note.optional(),
      skip: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('How many claims at the front of the queue to leave out: the nextSkip of the last call'),
    },
    destructive: true,
  },
  {
    name: 'decline_wallet_proof',
    description:
      'Turn down the wallet proof a person added and ask for new proof. Their files are deleted and the claim stays waiting.',
    shape: { claimId: z.uuid(), note },
    destructive: true,
  },
  {
    name: 'set_application_check',
    description:
      'Tick or untick one check on an application in review. Changing a check takes off the ready mark.',
    shape: {
      userId: z.string().min(1),
      check: z.string().min(1).describe('The name of the check'),
      value: z.boolean(),
    },
  },
  {
    name: 'run_application_lookups',
    description: 'Run the public-record lookups for an application in review.',
    shape: { userId: z.string().min(1) },
  },
  {
    name: 'mark_application_ready',
    description:
      'Mark an application ready for a second person to approve. Every check must be ticked.',
    shape: { userId: z.string().min(1) },
  },
  {
    name: 'approve_application',
    description:
      'Approve an application, which opens the account. It needs every check ticked and a second person: the one who marked it ready cannot approve it in production.',
    shape: { userId: z.string().min(1) },
  },
  {
    name: 'reject_application',
    description:
      'Reject an application with a reason, which the applicant sees. Pick the closest reason: registry (could not confirm the registration or standing), domain (email not on the organisation\'s own domain), identity, callback (could not reach the organisation), incomplete (not enough to check) or scope (not an organisation Celia can give access to). Add a note for details; send a note alone only when no reason fits. Never name a lookup, a sanctions list or another person in either.',
    shape: {
      userId: z.string().min(1),
      reason: z.enum(['registry', 'domain', 'identity', 'callback', 'incomplete', 'scope']).optional(),
      note: z.string().min(1).max(500).optional(),
    },
    destructive: true,
  },
  {
    name: 'retry_mail',
    description: 'Put a failed email back in the queue to be tried again.',
    shape: { id: z.uuid() },
  },
  {
    name: 'allow_mail',
    description: 'Allow mail to an address again after it bounced or complained.',
    shape: { email: z.email() },
  },
  {
    name: 'disconnect_sandworm',
    description:
      "Disconnect the staff member's Sandworm sign-in from Celia. Connecting is done in the staff area.",
    shape: {},
    destructive: true,
  },
];

/**
 * The tools for Celia staff: what is waiting in the review queues, research on Sandworm, saving a case's research report, and every
 * change the staff area can make. The queues are the same counts and claims as the staff area, without any name, email, wallet
 * address or proof file. Every tool that writes goes through the web app, which holds it to the staff area's rules and records it in
 * the staff audit. The changes also need a yes: the first call changes nothing and says what it would do, and only a second call
 * with `confirmed: true`, made after the staff member agrees, goes through.
 * @param server - The MCP server.
 * @param web - Asks the Celia web app as the caller.
 */
export function registerStaffTools(server: McpServer, web: WebClient) {
  server.registerTool(
    'staff_overview',
    {
      description:
        'How many applications, claims and failed emails are waiting for the Celia team.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/overview')),
  );

  server.registerTool(
    'list_claims_to_review',
    {
      description:
        'List the sent claims waiting for staff, oldest first, 50 a page: the platform, the kind of loss, the chain, the amount, whether the wallet is proven, how many files and whether a video it comes with (screenshots and a video are the strongest evidence), the reasons a claim may need a closer look, and your earlier review of it if you made one. It also counts the whole queue: waiting, reviewed and flagged. It has no names, emails, wallet addresses or proof files. To review a long queue, call it with unreviewed: true, review that page with review_claims, and call again with page 1 until the page comes back empty: reviewed claims drop out of the list. Then tell the staff member how many you flagged. Only staff accept. You turn claims down only through triage_claims, which does it for claims with no wallet signature, file or video.',
      inputSchema: {
        unreviewed: z
          .boolean()
          .optional()
          .describe('List only the claims you have not reviewed yet'),
        page: z.number().int().positive().optional().describe('The page, from 1'),
      },
    },
    handle(
      async ({ unreviewed, page }) =>
        await web(`/api/mcp/staff/claims?unreviewed=${unreviewed ?? false}&page=${page ?? 1}`),
    ),
  );

  server.registerTool(
    'list_claims',
    {
      description:
        'List every claim in the case bank, newest first, 25 to a page, with the platform, person or group it names, its contact handle, the kind of loss, the chain, the amount, the dates and whether it is sent, confirmed or rejected. Search by the name or handle. It has no claimant names, emails, wallets, transactions or proof files, and no account of what happened; for that read get_case_claim_accounts.',
      inputSchema: {
        page: z.number().int().min(1).optional().describe('The page, from 1'),
        search: z
          .string()
          .max(100)
          .optional()
          .describe('Keep only claims whose platform, person, group or handle matches'),
      },
    },
    handle(async ({ page, search }) => {
      const query = new URLSearchParams({ page: String(page ?? 1) });

      if (search) {
        query.set('search', search);
      }

      return await web(`/api/mcp/staff/claims/all?${query}`);
    }),
  );

  server.registerTool(
    'get_case_claim_accounts',
    {
      description:
        `Read the claims pooled into one case, 25 to a page, each with the claimant's own account of what happened, the dates, the amount and the chain. Use it to work out what the claimants allege was done, then propose alleged actions with add_alleged_action, grouped by what was done and when, in general words. The accounts are free text and can hold a name or a wallet: copy neither into an alleged action, a note, a notebook or anywhere else, and never declare fraud. Show the staff member the actions you propose before you add them. ${claimantRule}`,
      inputSchema: {
        caseId,
        page: z.number().int().min(1).optional().describe('The page, from 1'),
      },
    },
    handle(
      async ({ caseId: id, page }) =>
        await web(`/api/mcp/staff/cases/${id}/claims?page=${page ?? 1}`),
    ),
  );

  server.registerTool(
    'research_case_claims',
    {
      description:
        `Research the platform of a case off the chain, from the hosts its confirmed claims name, and get back evidence drafts: when its domain was registered (public registry) and when the Internet Archive first saved the site, each with a link to open and a plain note. A draft is not evidence and nothing is saved. It becomes evidence only when it is confirmed, and then you add it with add_evidence using the draft's type, title, note, sourceUrl and capturedOn. A staff member can confirm any draft: show it, and add it after they say yes. You may confirm a draft from this tool yourself, but only after you opened its link and saw that it shows what the note says; then add it, set lawful to true (these are public registry and archive records) and record review_evidence with a note on what you checked. Never confirm anything else this way. Celia reads the claims itself, so no claimant wallet, name or statement reaches you. The on-chain research is not here: it belongs to the Sandworm analysis. Describe what the records show, never fraud. ${claimantRule}`,
      inputSchema: { caseId },
    },
    handle(async ({ caseId: id }) => await web(`/api/mcp/staff/cases/${id}/claim-research`)),
  );

  server.registerTool(
    'get_report_format',
    {
      description:
        'The format a case report must have, as a JSON schema, with the rules the checks add. Read it before turning an analysis, such as a published Sandworm notebook, into findings for save_case_report.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/report-format')),
  );

  server.registerTool(
    'get_analysis_brief',
    {
      description:
        "The analysis briefs a staff member approved for a case that have no report yet: for each, the platform statement it checks, the template, chains, the platform's addresses, the window, the tests, the budget, its run number and its commitment. Each statement of the platform is researched on its own, with its own notebook and its own report. Run exactly one brief and nothing else. If several are waiting, ask the staff member which run, then call again with run. If none is approved it says so; tell the staff member, and do not start an analysis. Approving is done with approve_analysis_brief, after the staff member agrees.",
      inputSchema: {
        caseId: z.uuid().describe('The case id from list_cases'),
        run: z.number().int().positive().optional().describe('The run number of the plan to do'),
      },
    },
    handle(
      async ({ caseId, run }) =>
        await web(`/api/mcp/staff/cases/${caseId}/analysis-brief${run ? `?run=${run}` : ''}`),
    ),
  );

  server.registerTool(
    'preview_analysis_plan',
    {
      description:
        'Preview the research plan for one statement before anyone approves it, as the staff page shows it: the problems that stop it and, once none is left, the brief with its tests, chains, window and budget. It saves nothing. Show it to the staff member before approve_analysis_brief.',
      inputSchema: {
        caseId,
        statementId: z.uuid().describe('The statement id from get_case_lists'),
      },
    },
    handle(
      async ({ caseId: id, statementId }) =>
        await web(`/api/mcp/staff/cases/${id}/plan-preview?statementId=${statementId}`),
    ),
  );

  server.registerTool(
    'start_evidence_upload',
    {
      description:
        'Get a one-minute address to upload a video, image or document to IPFS, so the file never passes through Celia. Send the file to the address as a multipart upload (curl -F file=@name URL); the answer holds the file id (data.id), which add_evidence takes as pinId. It changes nothing on the case. If it says off, file uploads are not set up.',
      inputSchema: { fileName: z.string().min(1).max(200).describe('The name of the file') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handle(
      async ({ fileName }) =>
        await web('/api/mcp/staff/evidence-upload', { body: { fileName } }),
    ),
  );

  server.registerTool(
    'get_report_drafts',
    {
      description:
        'Read the reports of a case that are still in review, with their findings: drafts waiting for review_case_report, and reviewed reports waiting for a person. Read a draft here before you review it.',
      inputSchema: { caseId },
    },
    handle(async ({ caseId: id }) => await web(`/api/mcp/staff/cases/${id}/report-drafts`)),
  );

  server.registerTool(
    'review_case_report',
    {
      description:
        "Review a draft report and write the message for the person who decides. Read the draft with get_report_drafts, check it against its approved plan: that the loss and the tests can be read, that it says what the chain shows and what it does not, that it never declares fraud, and that no claimant's name, wallet or statement is in it. Give the verdict pass, or concerns when the person should look closely, and a short plain message: what you checked, what to look at, and your recommendation. This does not publish anything: a person says yes or no in the staff area, and no tool can do that for them. Review a draft another run wrote, not your own, when you can.",
      inputSchema: {
        caseId,
        run: z.number().int().positive().describe('The run number of the report'),
        version: z.number().int().positive().describe('The version of that report'),
        verdict: z.enum(['pass', 'concerns']),
        message: z
          .string()
          .min(1)
          .max(2000)
          .describe('Your message to the person: what you checked, what to look at, what you recommend'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handle(
      async ({ caseId: id, ...review }) =>
        await web(`/api/mcp/staff/cases/${id}/report-review`, { body: review }),
    ),
  );

  server.registerTool(
    'review_claims',
    {
      description:
        `Review sent claims and pick the interesting ones for staff. Read them with list_claims_to_review and skip the ones that already have your review. Flag first the claims with a video or files, then signed wallets with a large loss. For each claim say whether it is worth a closer look (interesting: true) and write a short message for the staff member: what you saw (the signals, the amount, the chain, whether the wallet is proven, how it fits other claims on the same platform), why you flagged it or not, and what you suggest. Flagged claims appear on their own tab, selected by the assistant. This only advises: it accepts and rejects nothing, only staff do. Use general words, never declare fraud, and copy no name, wallet or account text into a message. ${claimantRule}`,
      inputSchema: {
        reviews: z
          .array(
            z.object({
              claimId: z.uuid().describe('The claim id from list_claims_to_review'),
              interesting: z.boolean(),
              message: z.string().min(1).max(1000),
            }),
          )
          .min(1)
          .max(50),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    handle(async ({ reviews }) => await web('/api/mcp/staff/claims/review', { body: { reviews } })),
  );

  server.registerTool(
    'list_applications',
    {
      description:
        'List the applications waiting for review, oldest first: the organisation, its registration, website and jurisdictions, whether the work email is on its own domain, the checks ticked, the lookups and who marked it ready. It has no applicant name or email.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/applications')),
  );

  server.registerTool(
    'get_application',
    {
      description:
        'Read one application in review with the staff activity on it, and when the applicant verified their email and last signed in. It has no applicant name, email or phone.',
      inputSchema: { userId: z.string().min(1).describe('The id from list_applications') },
    },
    handle(
      async ({ userId }) => await web(`/api/mcp/staff/applications/${encodeURIComponent(userId)}`),
    ),
  );

  server.registerTool(
    'get_mail_status',
    {
      description:
        'The mail queue: how many messages wait or are being sent, the latest failures with their errors, and the addresses mail stopped going to. Retry a failure with retry_mail and allow an address with allow_mail.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/mail')),
  );

  server.registerTool(
    'get_staff_activity',
    {
      description:
        'The latest staff activity, newest first: who did what and to which record, as the staff area shows it.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/activity')),
  );

  server.registerTool(
    'sandworm_status',
    {
      description:
        'Whether Sandworm is set up, and whether the signed-in staff member has connected it and when they last used it. Connecting is a sign-in in the browser: if they have not, tell them to open Staff, Sandworm in Celia and press Connect Sandworm.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/sandworm/status')),
  );

  server.registerTool(
    'get_analysis_contract',
    {
      description:
        'The contract for an analysis run: the JSON schema of the findings file the template notebook writes, and the rules for the run (fork the template, set only its parameter cells, write and read the findings file, never put a claimant wallet in a notebook). Read it before running an approved brief.',
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/analysis-contract')),
  );

  server.registerTool(
    'sandworm_list_tools',
    {
      description:
        "List the tools of the Sandworm MCP (notebooks, runs, results and so on) with their inputs. They run as the signed-in staff member in Celia's Sandworm workspace. If it says the staff member has not connected Sandworm, tell them to open Staff, Sandworm in Celia and press Connect Sandworm.",
      inputSchema: {},
    },
    handle(async () => await web('/api/mcp/staff/sandworm/tools')),
  );

  server.registerTool(
    'sandworm_call',
    {
      description:
        "Call one Sandworm tool (named by sandworm_list_tools) as the signed-in staff member. Celia sends it to its own workspace, so leave workspaceId out. This can create notebooks and start runs, and Sandworm keeps the arguments and results in the notebook's chat; an attested notebook is public for good. So put public facts only in it: the platform's addresses, never a claimant's name, wallet or statement. Celia refuses a call that carries a claimant's wallet, and records every call in the staff audit.",
      inputSchema: {
        tool: z.string().describe('The Sandworm tool name from sandworm_list_tools'),
        arguments: z
          .record(z.string(), z.unknown())
          .default({})
          .describe("The tool's arguments, as sandworm_list_tools describes them"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handle(
      async ({ tool, arguments: args }) =>
        await web('/api/mcp/staff/sandworm/call', { body: { tool, arguments: args } }),
    ),
  );

  server.registerTool(
    'save_case_report',
    {
      description:
        `Save the findings of one analysis (one platform statement, one notebook) as a new DRAFT version of its report. The report holds exactly one check and names the approved plan it ran in method.commitment. A draft is shown to nobody outside the staff area: it must then be reviewed (review_case_report) and a person must say yes in the staff area before it becomes the case's report. Earlier versions are kept. Read the current shape with get_report. Public facts only: counts, the platform's addresses and what the tests found, never a claimant's name, wallet or statement. Every test needs a table (columns and rows), and the estimate needs a loss in dollars. Never declare fraud: say what the chain shows and what it does not. If Celia refuses the report it says what to fix. ${claimantRule}`,
      inputSchema: {
        caseId: z.uuid().describe('The case id from list_cases'),
        report: z
          .record(z.string(), z.unknown())
          .describe(
            'The findings as JSON in the report format: version 1, headline, figures, checks (claim, evidence, result, tests, proof), tests (id, title, summary, columns, rows), method (commitment, notebookUrl), dataAsOf and sources',
          ),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handle(
      async ({ caseId, report }) =>
        await web(`/api/mcp/staff/cases/${caseId}/report`, { body: { report } }),
    ),
  );

  server.registerTool(
    'get_case_lists',
    {
      description:
        'The lists staff keep on a case, with the ids a change needs: the alleged actions with how much evidence backs each, the evidence, the alleged actors by their place in the list, and the statements with where their research stands. Read it before you change a list.',
      inputSchema: { caseId },
    },
    handle(async ({ caseId: id }) => await web(`/api/mcp/staff/cases/${id}/lists`)),
  );

  for (const change of changes) {
    server.registerTool(
      change.name,
      {
        description: `${change.description} ${confirmation}`,
        inputSchema: { ...change.shape, confirmed },
        annotations: {
          readOnlyHint: false,
          destructiveHint: change.destructive ?? false,
          idempotentHint: false,
        },
      },
      handle(
        async ({ confirmed: yes, ...input }) =>
          await web('/api/mcp/staff/act', {
            body: { action: change.name, input, confirmed: yes === true },
          }),
      ),
    );
  }
}
