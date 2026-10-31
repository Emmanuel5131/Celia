import { randomBytes } from 'node:crypto';
import { searchJurisdictions } from '@celia/jurisdictions';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { caseActionSchema, caseEvidenceSchema, caseSchema } from '@/models/Schema';
import type { CaseOperator } from '@/utils/cases/Operators';

/**
 * Fills one local case with sample suspected people and groups, alleged actions, and evidence attached to them, so its page shows
 * every list with rows. Everything is invented: names, handles, links and hashes. No file is uploaded, so no evidence here is a
 * video, picture or document. Running it again replaces its own rows and leaves the rest of the case alone.
 *
 * Run: `pnpm exec dotenv -c -- tsx scripts/seed/case-details.ts <case id>`. It refuses to run against a database that is not on
 * this machine.
 */
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(Env.DATABASE_URL).hostname)) {
  throw new Error('This only runs against a local database.');
}

const caseId = process.argv.slice(2).at(0);

if (!caseId) {
  throw new Error('Pass the case id: tsx scripts/seed/case-details.ts <case id>');
}

const SEED = 'seed:case-details';

const [found] = await db.select().from(caseSchema).where(eq(caseSchema.id, caseId));

if (!found) {
  throw new Error(`No case ${caseId}.`);
}

const place = (name: string) => {
  const [match] = searchJurisdictions(name, { limit: 1 });

  if (!match) {
    throw new Error(`No jurisdiction called ${name}.`);
  }

  return match.id;
};

const hash = () => `0x${randomBytes(32).toString('hex')}`;
const address = () => `0x${randomBytes(20).toString('hex')}`;

const operators: CaseOperator[] = [
  {
    name: 'Harbor Ridge Holdings Ltd',
    role: 'runs',
    roleNote: null,
    jurisdiction: place('Cyprus'),
    notes: 'Named as the registered company in the platform terms. Sample row.',
  },
  {
    name: 'Telegram group "Daily Signals VIP"',
    role: 'promotes',
    roleNote: null,
    jurisdiction: place('India'),
    notes: 'Admins posted deposit addresses and screenshots of payouts. Sample row.',
  },
  {
    name: 'Payment desk operator "Mr. K"',
    role: 'money',
    roleNote: null,
    jurisdiction: place('United Arab Emirates'),
    notes: 'Claimants say deposits were sent to wallets this person shared in chat. Sample row.',
  },
  {
    name: 'Influencer network "ProfitCrew"',
    role: 'promotes',
    roleNote: null,
    jurisdiction: place('Nigeria'),
    notes: 'Paid posts with referral links across several video channels. Sample row.',
  },
];

// Previous sample rows go, and so do the operator rows with the same names, so running again does not repeat them.
await db
  .delete(caseEvidenceSchema)
  .where(and(eq(caseEvidenceSchema.caseId, caseId), eq(caseEvidenceSchema.createdBy, SEED)));
await db
  .delete(caseActionSchema)
  .where(and(eq(caseActionSchema.caseId, caseId), eq(caseActionSchema.createdBy, SEED)));
await db
  .update(caseSchema)
  .set({
    operatorRows: [
      ...found.operatorRows.filter((row) => !operators.some((sample) => sample.name === row.name)),
      ...operators,
    ],
  })
  .where(eq(caseSchema.id, caseId));

const actions: {
  kind: string;
  title: string;
  note: string;
  occurredOn: string;
  place: string;
}[] = [
  {
    kind: 'statement',
    title: 'Said in public that withdrawals are always available',
    note: 'Posted on the platform site and repeated in the Telegram group.',
    occurredOn: '2026-03-02',
    place: 'Cyprus',
  },
  {
    kind: 'promotion',
    title: 'Promoted the platform with paid videos and referral links',
    note: 'A network of channels posted the same offer within the same week.',
    occurredOn: '2026-03-09',
    place: 'Nigeria',
  },
  {
    kind: 'deposits',
    title: 'Took deposits to a small set of wallets',
    note: 'Claimants were told to send funds to addresses shared in chat.',
    occurredOn: '2026-03-15',
    place: 'United Arab Emirates',
  },
  {
    kind: 'funds_moved',
    title: 'Moved the deposits on to a second wallet and then an exchange',
    note: 'Transfers followed within hours of each large deposit.',
    occurredOn: '2026-04-03',
    place: 'United Arab Emirates',
  },
  {
    kind: 'withdrawals',
    title: 'Stopped withdrawals and asked for a fee to release funds',
    note: 'Several claimants report the same message from the support chat.',
    occurredOn: '2026-04-20',
    place: 'India',
  },
];

const added = await db
  .insert(caseActionSchema)
  .values(
    actions.map((action) => ({
      caseId,
      kind: action.kind,
      title: action.title,
      note: action.note,
      occurredOn: action.occurredOn,
      jurisdiction: place(action.place),
      createdBy: SEED,
    })),
  )
  .returning({ id: caseActionSchema.id });

const [statement, promotion, deposits, moved, stopped] = added.map((row) => row.id);

if (!statement || !promotion || !deposits || !moved || !stopped) {
  throw new Error('The actions were not added.');
}

const evidence = [
  {
    type: 'link' as const,
    title: 'Platform page: "Withdraw any time"',
    note: 'Archived copy of the page that makes the statement.',
    sourceUrl: 'https://web.archive.org/web/2026/https://example.com/harbor-ridge/terms',
    capturedOn: '2026-03-03',
    actionId: statement,
  },
  {
    type: 'link' as const,
    title: 'Promotion video on a video channel',
    note: 'Shows the referral link and the promised daily return.',
    sourceUrl: 'https://example.com/watch?v=profitcrew-001',
    capturedOn: '2026-03-10',
    actionId: promotion,
  },
  {
    type: 'wallet' as const,
    title: 'Deposit wallet shared in the chat',
    note: 'The address claimants say they were told to pay.',
    chain: 'ethereum' as const,
    reference: address(),
    capturedOn: '2026-03-16',
    actionId: deposits,
  },
  {
    type: 'transaction' as const,
    title: 'Largest deposit into that wallet',
    note: 'Sample transaction.',
    chain: 'ethereum' as const,
    reference: hash(),
    capturedOn: '2026-03-17',
    actionId: deposits,
  },
  {
    type: 'notebook' as const,
    title: 'Sandworm notebook: where the deposits went',
    note: 'Follows the deposits from the first wallet to the exchange.',
    sourceUrl: 'https://example.com/sandworm/notebooks/deposit-flow',
    capturedOn: '2026-04-05',
    actionId: moved,
  },
  {
    type: 'chat' as const,
    title: 'Sandworm chat: reading the transfer pattern',
    note: 'The questions asked of the notebook and the answers it gave.',
    sourceUrl: 'https://example.com/sandworm/chats/transfer-pattern',
    capturedOn: '2026-04-05',
    actionId: moved,
  },
  {
    type: 'script' as const,
    title: 'Python script: groups the transfers by hour',
    note: 'Reads the public transfers and counts how soon each deposit moved on.',
    sourceUrl: 'https://example.com/gist/transfer-timing.py',
    capturedOn: '2026-04-06',
    actionId: moved,
  },
  {
    type: 'link' as const,
    title: 'Support chat message asking for a release fee',
    note: 'Screenshot posted by a claimant in a public group.',
    sourceUrl: 'https://example.com/support-chat/release-fee',
    capturedOn: '2026-04-21',
    actionId: stopped,
  },
];

await db
  .insert(caseEvidenceSchema)
  .values(evidence.map((item) => ({ ...item, caseId, createdBy: SEED })));

console.log(
  `Seeded case ${caseId}: ${operators.length} suspected people, ${actions.length} actions, ${evidence.length} pieces of evidence.`,
);
process.exit(0);
