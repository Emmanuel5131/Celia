import { randomUUID } from 'node:crypto';
import { platformKey } from '@celia/core';
import { getJurisdiction } from '@celia/jurisdictions';
import { createClerkClient } from '@clerk/nextjs/server';
import { and, count as countRows, eq, inArray, isNotNull, like, or } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { Env } from '@/libs/Env';
import {
  caseEventSchema,
  caseReportSchema,
  caseSchema,
  caseTeamSchema,
  claimSchema,
  counselProfileSchema,
  institutionApplicationSchema,
  identityCheckSchema,
  userSettingSchema,
} from '@/models/Schema';
import type { CaseEventType } from '@/models/Schema';
import { readyToBuild } from '@/utils/cases/Case';
import type { CaseStatus } from '@/utils/cases/Case';
import { describeCase, hashReport } from '@/utils/cases/Report';
import { createDbConnection } from '@/utils/DBConnection';
import { ReportValidation } from '@/validations/ReportValidation';
import { buildClaim, DAY, inventedWord, money, usStates, victimCountries } from './claims';
import type { CaseFacts } from './claims';
import { hex, int, logNormal, pick, random, waiting, weighted } from './random';
import { scenarios } from './scenarios';
import type { Scenario } from './scenarios';

/**
 * Fills the local database with sample cases, claims, claimants, reports and activity, shaped like the fraud reports they are
 * modelled on (see `scenarios.ts`): most cases are small, a few gather hundreds of claims, victims come from where reports
 * say they do, and claims arrive over weeks. Claimants are `seed_user_*`, and every operator is invented. A few claimants are
 * real accounts in a Clerk development instance, so they can sign in. Running it again replaces the sample rows and touches
 * nothing else. It refuses to run against a database that is not on this machine.
 */
const CASES = 1000;

/** Multiplies how many claims each case gets. 1 gives about 85,000 claims in all; 10 gives close to a million. */
const CLAIM_SCALE = 1;

/** The accounts that are real in Clerk. Sign in with the email and the test code 424242; no password is set. */
const accounts = [
  {
    email: 'staff+clerk_test@example.com',
    first: 'Sam',
    metadata: { accountType: 'person', staff: true },
  },
  {
    email: 'counsel+clerk_test@example.com',
    first: 'Lena',
    metadata: { accountType: 'counsel', review: 'verified' },
  },
  {
    email: 'counsel-pending+clerk_test@example.com',
    first: 'Omar',
    metadata: { accountType: 'counsel', review: 'pending' },
  },
  ...['Ada', 'Ben', 'Chidi', 'Dara', 'Eli'].map((first, index) => ({
    email: `person${index + 1}+clerk_test@example.com`,
    first,
    metadata: { accountType: 'person' },
  })),
];
const withdrawalClaims = [
  'Withdrawals are always available.',
  'Returns are paid from trading profit.',
  'Funds are held in a separate reserve.',
  'The platform has been operating for several years.',
];

/** A findings report in the house language, with tests whose figures agree with each other. */
function buildReport(options: { wallets: number; opened: number }) {
  const received = int(40, 900) * 1000;
  const outgoing = int(0, 6);
  const dataAsOf = new Date(options.opened).toISOString();

  return ReportValidation.parse({
    version: 1,
    headline: `The chain shows ${options.wallets} wallets sending funds to the same address. It does not show intent.`,
    estimate: { wallets: String(options.wallets), losses: money(received), lossUsd: received },
    figures: [
      {
        label: 'Wallets affected',
        value: String(options.wallets),
        note: 'that sent funds to the platform',
      },
      {
        label: 'Estimated lost to this platform',
        value: money(received),
        note: 'sent to the platform address',
      },
    ],
    checks: withdrawalClaims.map((claim, index) => ({
      claim,
      evidence:
        index === 0
          ? 'Outgoing transfers to users fall to zero and stay there for the rest of the period read.'
          : 'The chain data read does not settle this.',
      result: index === 0 ? 'proven' : 'not_checkable',
      tests: index === 0 ? ['withdrawals-by-week'] : ['funding-sources'],
    })),
    tests: [
      {
        id: 'withdrawals-by-week',
        title: 'Withdrawals by week',
        summary: 'Outgoing transfers to users per week, counted from the first deposit.',
        columns: ['Week', 'Outgoing to users'],
        rows: [
          ['Week 1', String(int(10, 40))],
          ['Week 2', String(int(5, 20))],
          ['Week 3', String(outgoing)],
          ['Week 4', '0'],
        ],
      },
      {
        id: 'funding-sources',
        title: 'Funding sources',
        summary: 'Where the wallets that deposited got their funds.',
        columns: ['Source', 'Wallets'],
        rows: [
          ['Exchange withdrawals', String(Math.round(options.wallets * 0.7))],
          ['Other wallets', String(Math.round(options.wallets * 0.3))],
        ],
      },
    ],
    method: { commitment: `0x${hex(64)}` },
    dataAsOf,
    sources: ['Public chain data'],
  });
}

/** Whether the connection points at this machine. A seed must never run against a shared database. */
function isLocal(url: string) {
  return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname);
}

if (!isLocal(Env.DATABASE_URL)) {
  throw new Error('Seeding only runs against a local database.');
}

const db = createDbConnection();
const now = Date.now();

// Clerk would accept these accounts on a production instance too, so the key is checked first.
if (!Env.CLERK_SECRET_KEY.startsWith('sk_test_')) {
  throw new Error('Seeding only creates accounts in a Clerk development instance.');
}

const clerk = createClerkClient({ secretKey: Env.CLERK_SECRET_KEY });
const clerkIds = new Map<string, string>();

for (const account of accounts) {
  const existing = await clerk.users.getUserList({ emailAddress: [account.email] });
  const user =
    existing.data[0] ??
    (await clerk.users.createUser({
      emailAddress: [account.email],
      firstName: account.first,
      lastName: 'Seed',
      skipPasswordRequirement: true,
    }));

  await clerk.users.updateUserMetadata(user.id, { publicMetadata: account.metadata });
  clerkIds.set(account.email, user.id);
}

const chunks = <T>(rows: T[], size = 500) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );

for (const id of [...victimCountries.map(([country]) => country), ...usStates]) {
  if (!getJurisdiction(id)) {
    throw new Error(`Unknown jurisdiction: ${id}`);
  }
}

const realIds = [...clerkIds.values()];
const realPeople = accounts
  .filter((account) => account.email.startsWith('person'))
  .flatMap((account) => clerkIds.get(account.email) ?? []);
const seedUsers = (column: PgColumn) =>
  or(like(column, 'seed\\_user\\_%'), inArray(column, realIds));

// Most claimants file once; some are hit twice, as people are. New ones are made as cases need them.
const strangers: string[] = [];
const claimants: string[] = [...realIds];

function nextClaimant(taken: Set<string>) {
  for (;;) {
    const reuse = strangers.length > 0 && random() < 0.12;
    const id = reuse
      ? pick(strangers)
      : `seed_user_${String(strangers.length + 1).padStart(5, '0')}`;

    if (!reuse) {
      strangers.push(id);
      claimants.push(id);
    }

    if (!taken.has(id)) {
      return id;
    }
  }
}

const usedKeys = new Set<string>();

function operatorName(scenario: Scenario) {
  for (;;) {
    const name = pick(scenario.names)
      .replace('{w}', inventedWord())
      .replace('{h}', hex(4).toUpperCase());
    const key = platformKey(name);

    if (!usedKeys.has(key)) {
      usedKeys.add(key);

      return { name, key };
    }
  }
}

const sizeOf = (scenario: Scenario) =>
  Math.min(
    1500 * CLAIM_SCALE,
    Math.max(1, Math.round(logNormal(scenario.size.median * CLAIM_SCALE, scenario.size.spread))),
  );

const plans = Array.from({ length: CASES }, () => {
  const scenario = weighted(scenarios.map((item): [Scenario, number] => [item, item.weight]));

  return { scenario, size: sizeOf(scenario) };
});

// Each real claimant is in several cases, so signing in as one shows a believable list.
const mine = new Map<number, string[]>();

for (const person of realPeople) {
  const larger = plans.flatMap((plan, index) => (plan.size >= 10 ? [index] : []));

  for (const index of [...larger].toSorted(() => random() - 0.5).slice(0, 8)) {
    mine.set(index, [...(mine.get(index) ?? []), person]);
  }
}

type EventRow = typeof caseEventSchema.$inferInsert;

const cases: (typeof caseSchema.$inferInsert)[] = [];
const claimJobs: (() => (typeof claimSchema.$inferInsert)[])[] = [];
const reports: (typeof caseReportSchema.$inferInsert)[] = [];
const events: EventRow[] = [];
const WEEK = 7 * DAY;

for (const [index, plan] of plans.entries()) {
  const { scenario, size } = plan;
  const { name, key } = operatorName(scenario);
  const id = randomUUID();
  const word = name.split(' ')[0] ?? name;
  const country = weighted(victimCountries);
  const opened = now - int(10, 540) * DAY;
  const mean = (20 + Math.min(size, 400) * 0.15) * DAY;
  const arrivals = Array.from({ length: size }, () =>
    Math.min(opened + waiting(mean), now - int(0, 3) * DAY),
  ).toSorted((a, b) => a - b);
  const lastClaim = arrivals.at(-1) ?? opened;
  const event = (type: CaseEventType, at: number, count = 1) =>
    events.push({ caseId: id, type, count, createdAt: new Date(at) });

  // Bigger cases are further along: more have been built or sealed.
  const roll = random();
  const sealedShare = size >= 100 ? 0.5 : size >= 25 ? 0.3 : 0.1;
  const status: CaseStatus = roll < sealedShare ? 'sealed' : size >= 8 ? 'building' : 'collecting';

  const facts: CaseFacts = {
    name,
    key,
    host: scenario.names.some((template) => template.includes('{h}'))
      ? null
      : `${name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')}.example`,
    country: country.toUpperCase(),
    now,
    handle: scenario.handle
      ? `@${word.toLowerCase()}_${pick(['support', 'desk', 'vip', 'official', 'team'])}`
      : null,
    token: scenario.token ? `${name} (${word.slice(0, 5).toUpperCase()})` : null,
    deposit: new Map(),
    contract: new Map(),
  };

  const chosen = new Set<string>(mine.get(index));

  while (chosen.size < size) {
    chosen.add(nextClaimant(chosen));
  }

  const users = [...chosen].toSorted(() => random() - 0.5);

  claimJobs.push(() =>
    users.map((userId, position) =>
      buildClaim(scenario, facts, {
        userId,
        submittedAt: arrivals[position] ?? lastClaim,
        country: random() < 0.7 ? facts.country : weighted(victimCountries).toUpperCase(),
      }),
    ),
  );

  event('case_opened', opened);

  // Claims reach staff week by week, so the activity on a case has a shape.
  const weeks = new Map<number, number>();

  for (const at of arrivals) {
    const week = Math.floor((at - opened) / WEEK);

    weeks.set(week, (weeks.get(week) ?? 0) + 1);
  }

  for (const [week, count] of weeks) {
    event('claim_added', Math.min(opened + (week + 1) * WEEK, lastClaim), count);
  }

  let updated = lastClaim;
  let description: string | null = null;
  let lossUsd: number | null = null;
  const reportCount =
    status === 'sealed' ? (random() < 0.2 ? 2 : 1) : status === 'building' ? 1 : 0;

  for (let version = 1; version <= reportCount; version++) {
    const savedAt = Math.min(now, lastClaim + version * int(2, 10) * DAY);
    // Only some of the people a platform harmed ever file a claim.
    const snapshot = buildReport({ wallets: size * int(8, 30), opened: savedAt });

    description = describeCase(snapshot);
    lossUsd = snapshot.estimate?.lossUsd ?? null;
    reports.push({
      caseId: id,
      version,
      snapshot,
      hash: hashReport(snapshot),
      savedBy: 'seed_staff',
      createdAt: new Date(savedAt),
    });
    event('report_saved', savedAt);
    updated = savedAt;
  }

  if (status === 'sealed') {
    updated = Math.min(Math.max(now - int(0, 60) * DAY, lastClaim + 20 * DAY), now);
    event('case_sealed', updated);
  }

  cases.push({
    id,
    name,
    platformKey: key,
    description,
    estimatedLossUsd: lossUsd,
    status,
    createdAt: new Date(opened),
    updatedAt: new Date(Math.min(updated, now)),
  });
}

// The work is done in steps, not one transaction: this much in one go is more than a small local database can hold. If a step
// fails, run the seed again; it clears what an earlier run left.
const earlier = await db
  .selectDistinct({ key: claimSchema.platformKey })
  .from(claimSchema)
  .where(seedUsers(claimSchema.userId));

for (const batch of chunks(
  earlier.flatMap((row) => row.key ?? []),
  25,
)) {
  const found = await db
    .select({ id: caseSchema.id })
    .from(caseSchema)
    .where(inArray(caseSchema.platformKey, batch));
  const ids = found.map((row) => row.id);

  await db.delete(claimSchema).where(inArray(claimSchema.platformKey, batch));

  if (ids.length > 0) {
    await db.delete(caseEventSchema).where(inArray(caseEventSchema.caseId, ids));
    await db.delete(caseReportSchema).where(inArray(caseReportSchema.caseId, ids));
    await db.delete(caseTeamSchema).where(inArray(caseTeamSchema.caseId, ids));
    await db.delete(caseSchema).where(inArray(caseSchema.id, ids));
  }
}

await db.delete(claimSchema).where(seedUsers(claimSchema.userId));
await db.delete(userSettingSchema).where(seedUsers(userSettingSchema.userId));
await db.delete(identityCheckSchema).where(seedUsers(identityCheckSchema.userId));
await db.delete(counselProfileSchema).where(inArray(counselProfileSchema.userId, realIds));
await db
  .delete(institutionApplicationSchema)
  .where(inArray(institutionApplicationSchema.userId, realIds));

for (const rows of chunks(cases)) {
  await db.insert(caseSchema).values(rows);
}

for (const rows of chunks(
  claimants.map((userId) => ({ userId, locale: random() < 0.8 ? 'en' : 'fr' })),
)) {
  await db.insert(userSettingSchema).values(rows);
}

for (const rows of chunks(
  claimants.map((userId) => ({
    userId,
    status: 'verified' as const,
    verificationId: `seed_${userId}`,
    verifiedAt: new Date(now - int(30, 300) * DAY),
  })),
)) {
  await db.insert(identityCheckSchema).values(rows);
}

await db.insert(counselProfileSchema).values(
  accounts.flatMap((account) => {
    const userId = clerkIds.get(account.email);
    const { metadata } = account;

    return userId && 'review' in metadata
      ? [
          {
            userId,
            review: metadata.review as 'pending' | 'verified',
            firm: 'Seed & Partners',
            jurisdictions: ['ng', 'ke', 'us'],
          },
        ]
      : [];
  }),
);

// A lawyer waiting for review has an application to review, sent a few days ago.
await db.insert(institutionApplicationSchema).values(
  accounts.flatMap((account) => {
    const userId = clerkIds.get(account.email);

    return userId && 'review' in account.metadata && account.metadata.review === 'pending'
      ? [
          {
            userId,
            kind: 'law_firm' as const,
            organisation: 'Seed & Partners',
            registrationNumber: 'SEED-0001',
            website: 'https://seed-partners.example',
            submittedAt: new Date(now - 3 * DAY),
            reviewDueAt: new Date(now + 2 * DAY),
          },
        ]
      : [];
  }),
);

let claimTotal = 0;

for (const job of claimJobs) {
  const rows = job();

  claimTotal += rows.length;

  for (const part of chunks(rows)) {
    await db.insert(claimSchema).values(part);
  }
}

for (const rows of chunks(reports)) {
  await db.insert(caseReportSchema).values(rows);
}

for (const rows of chunks(events)) {
  await db.insert(caseEventSchema).values(rows);
}

// What the people on a case actually did decides its stage, by the same rule the app uses: enough confirmed claims and a big enough
// estimated loss is building evidence, whatever the plan above said. Only cases that are not sealed move.
const confirmedRows = await db
  .select({ key: claimSchema.platformKey, total: countRows() })
  .from(claimSchema)
  .where(and(eq(claimSchema.status, 'submitted'), isNotNull(claimSchema.validatedAt)))
  .groupBy(claimSchema.platformKey);
const confirmed = new Map(confirmedRows.map((row) => [row.key, row.total]));
const building = cases.filter(
  (row) =>
    row.status !== 'sealed' &&
    readyToBuild(confirmed.get(row.platformKey) ?? 0, row.estimatedLossUsd ?? null),
);
const collecting = cases.filter((row) => row.status !== 'sealed' && !building.includes(row));

for (const [status, group] of [
  ['building', building],
  ['collecting', collecting],
] as const) {
  for (const part of chunks(group.map((row) => row.id).filter((id) => id !== undefined))) {
    await db.update(caseSchema).set({ status }).where(inArray(caseSchema.id, part));
  }
}

const stages = await db
  .select({ status: caseSchema.status, total: countRows() })
  .from(caseSchema)
  .groupBy(caseSchema.status);
const stageText = stages.map((stage) => `${stage.total} ${stage.status}`).join(', ');

console.log(
  `Seeded ${cases.length} cases (now: ${stageText}), ${claimTotal} claims from ${claimants.length} claimants, ${reports.length} reports, ${events.length} events.`,
);
process.exit(0);
