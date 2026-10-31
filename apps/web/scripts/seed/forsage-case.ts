import { randomBytes } from 'node:crypto';
import { platformKey } from '@celia/core';
import { and, inArray, like } from 'drizzle-orm';
import { addConfirmedClaim } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { caseSchema, caseStatementSchema, claimAddressSchema, claimSchema } from '@/models/Schema';

/**
 * A local test case on a real, public contract: SmartWayForsage, an early Forsage contract on Ethereum (deployed 2020-01-20, 116
 * transactions in all, so a run reads all of it). The platform and its address are real; the six claimants are synthetic
 * (`seed_user_forsage_*`), because nobody's real claim belongs in a test. Two statements are quoted from the SEC complaint in
 * SEC v. Okhotnikov et al., 1:22-cv-03978 (N.D. Ill.), Document 1, which is public.
 *
 * Run: `pnpm exec dotenv -c -- tsx scripts/seed/forsage-case.ts`. Safe to run again.
 */
const CONTRACT = '0xbfdbD665A11c60B6465Ec687e23241fC74bfC2fa';
const NAME = 'Forsage SmartWay';
const COMPLAINT = 'https://www.sec.gov/files/litigation/complaints/2022/comp-pr2022-134.pdf';

if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(Env.DATABASE_URL).hostname)) {
  throw new Error('This only runs against a local database.');
}

const key = platformKey(NAME);

if (!key) {
  throw new Error('The platform name gives no key.');
}

// Start clean, so running it again gives the same six claims.
const old = await db
  .select({ id: claimSchema.id })
  .from(claimSchema)
  .where(like(claimSchema.userId, 'seed\\_user\\_forsage\\_%'));

if (old.length > 0) {
  const ids = old.map((row) => row.id);
  await db.delete(claimAddressSchema).where(inArray(claimAddressSchema.claimId, ids));
  await db.delete(claimSchema).where(inArray(claimSchema.id, ids));
}

const day = 86_400_000;
const paid = [
  ['2020-01-20', '2020-01-20'],
  ['2020-01-20', '2020-01-20'],
  ['2020-01-20', '2020-01-20'],
  ['2020-01-20', '2020-01-21'],
  ['2020-01-20', '2020-01-21'],
  ['2020-01-20', '2020-01-21'],
] as const;

for (const [index, [firstOn, lastOn]] of paid.entries()) {
  const at = new Date(Date.now() - (10 - index) * day);
  const [claim] = await db
    .insert(claimSchema)
    .values({
      userId: `seed_user_forsage_${String(index + 1).padStart(2, '0')}`,
      fraudType: 'investment_platform',
      fraudTypes: ['investment_platform'],
      paymentMethod: 'wallet',
      chain: 'ethereum',
      platformName: NAME,
      platformKey: key,
      destinationAddress: CONTRACT,
      firstPaymentOn: firstOn,
      lastPaymentOn: lastOn,
      assetSent: 'ETH',
      amountLost: 'Test claim, not a real amount',
      statement: 'Seeded test claim. Not a real person.',
      country: 'ng',
      nonce: randomBytes(16).toString('hex'),
      status: 'submitted',
      consentedAt: at,
      submittedAt: at,
      validatedAt: at,
      staffReviewStartedAt: at,
    })
    .returning({ id: claimSchema.id });

  if (!claim) {
    throw new Error('A claim was not saved.');
  }

  await db
    .insert(claimAddressSchema)
    .values({ claimId: claim.id, role: 'receiving', chain: 'ethereum', address: CONTRACT });
  await addConfirmedClaim(db, { platformKey: key, platformName: NAME });
}

const [opened] = await db
  .select({ id: caseSchema.id, number: caseSchema.seq })
  .from(caseSchema)
  .where(and(inArray(caseSchema.platformKey, [key])));

if (!opened) {
  throw new Error('The case was not opened.');
}

const held = await db
  .select({ id: caseStatementSchema.id })
  .from(caseStatementSchema)
  .where(inArray(caseStatementSchema.caseId, [opened.id]));

if (held.length === 0) {
  await db.insert(caseStatementSchema).values([
    {
      caseId: opened.id,
      kind: 'withdrawals',
      text: 'A Forsage founder said in a video, as quoted in the SEC complaint: "Here everyone decides for themselves when to withdraw, hold, no hold, and so on."',
      sourceUrl: COMPLAINT,
      createdBy: 'seed_script',
    },
    {
      caseId: opened.id,
      kind: 'other',
      text: 'A Forsage founder said in an interview, as quoted in the SEC complaint: "Forsage does not accumulate funds; its balance is always zero."',
      sourceUrl: COMPLAINT,
      saidOn: '2021-02-27',
      createdBy: 'seed_script',
    },
  ]);
}

console.log(
  `Case opened: ${NAME}, id ${opened.id}, number CB-${String(opened.number).padStart(4, '0')}`,
);
console.log(`Open: http://localhost:3000/dashboard/staff/cases/${opened.id}`);
process.exit(0);
