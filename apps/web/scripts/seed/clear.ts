import { and, count, inArray, isNull, like, notInArray, or } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  caseAnalysisSchema,
  caseEventSchema,
  caseEvidenceSchema,
  caseReportSchema,
  caseSchema,
  caseStatementSchema,
  caseTeamSchema,
  claimAddressSchema,
  claimProofSchema,
  claimRevisionSchema,
  claimSchema,
  claimTransactionSchema,
  identityCheckSchema,
  userSettingSchema,
} from '@/models/Schema';

/**
 * Clears the seeded data from a local database and keeps a few cases as examples, so the app is not empty. It removes every other
 * case with its claims, reports, events, statements, evidence and plans, and the seed users' settings and identity checks. It leaves real
 * accounts, lawyer profiles, applications, the Sandworm connection and the staff activity alone.
 *
 * Run: `pnpm exec dotenv -c -- tsx scripts/seed/clear.ts [--keep 110,1001] [--yes]`
 * Without `--yes` it only counts what it would remove. `--keep` takes case numbers (the digits of `CB-0110`).
 */
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(Env.DATABASE_URL).hostname)) {
  throw new Error('This only runs against a local database.');
}

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const keepArg = args.at(args.indexOf('--keep') + 1);
const keepSeq = (args.includes('--keep') && keepArg ? keepArg : '110,1001')
  .split(',')
  .map((value) => Number(value.trim()));

if (keepSeq.some((value) => !Number.isInteger(value) || value <= 0)) {
  throw new Error('--keep takes case numbers such as 110,1001.');
}

const kept = await db
  .select({ id: caseSchema.id, key: caseSchema.platformKey, seq: caseSchema.seq })
  .from(caseSchema)
  .where(inArray(caseSchema.seq, keepSeq));

if (kept.length !== keepSeq.length) {
  throw new Error(
    `Only ${kept.length} of the ${keepSeq.length} cases to keep exist. Nothing was changed.`,
  );
}

const keptIds = kept.map((item) => item.id);
const keptKeys = kept.map((item) => item.key);

// Claims of a kept platform stay; every other claim (and a draft with no platform) goes.
const doomedClaim = or(
  isNull(claimSchema.platformKey),
  notInArray(claimSchema.platformKey, keptKeys),
);
const doomedClaimIds = db.select({ id: claimSchema.id }).from(claimSchema).where(doomedClaim);
const remainingOwners = db.select({ id: claimSchema.userId }).from(claimSchema);
const seedPerson = (column: PgColumn) => like(column, 'seed\\_user\\_%');

const total = async (query: Promise<{ total: number }[]>) => {
  const [row] = await query;

  return row?.total ?? 0;
};

const counts = async () => ({
  cases: await total(db.select({ total: count() }).from(caseSchema)),
  claims: await total(db.select({ total: count() }).from(claimSchema)),
  reports: await total(db.select({ total: count() }).from(caseReportSchema)),
  events: await total(db.select({ total: count() }).from(caseEventSchema)),
  statements: await total(db.select({ total: count() }).from(caseStatementSchema)),
  plans: await total(db.select({ total: count() }).from(caseAnalysisSchema)),
  settings: await total(db.select({ total: count() }).from(userSettingSchema)),
  identityChecks: await total(db.select({ total: count() }).from(identityCheckSchema)),
});

const before = await counts();
console.log(`Keeping: ${kept.map((item) => `CB-${String(item.seq).padStart(4, '0')}`).join(', ')}`);
console.log('Before:', before);

if (!confirmed) {
  console.log('Dry run only. Add --yes to remove everything else.');
  process.exit(0);
}

await db.transaction(async (tx) => {
  // Children first, so no row points at one that is already gone.
  await tx.delete(claimAddressSchema).where(inArray(claimAddressSchema.claimId, doomedClaimIds));
  await tx
    .delete(claimTransactionSchema)
    .where(inArray(claimTransactionSchema.claimId, doomedClaimIds));
  await tx.delete(claimRevisionSchema).where(inArray(claimRevisionSchema.claimId, doomedClaimIds));
  await tx.delete(claimProofSchema).where(inArray(claimProofSchema.claimId, doomedClaimIds));
  await tx.delete(claimSchema).where(doomedClaim);

  for (const table of [
    caseEventSchema,
    caseReportSchema,
    caseTeamSchema,
    // Plans point at statements and reports at plans, so they go in that order.
    caseAnalysisSchema,
    caseEvidenceSchema,
    caseStatementSchema,
  ]) {
    await tx.delete(table).where(notInArray(table.caseId, keptIds));
  }

  await tx.delete(caseSchema).where(notInArray(caseSchema.id, keptIds));

  // A seed person's settings and identity check stay only while a claim of theirs does.
  await tx
    .delete(userSettingSchema)
    .where(
      and(
        seedPerson(userSettingSchema.userId),
        notInArray(userSettingSchema.userId, remainingOwners),
      ),
    );
  await tx
    .delete(identityCheckSchema)
    .where(
      and(
        seedPerson(identityCheckSchema.userId),
        notInArray(identityCheckSchema.userId, remainingOwners),
      ),
    );
});

console.log('After:', await counts());
process.exit(0);
