import { createClerkClient } from '@clerk/nextjs/server';
import * as z from 'zod';
import { saveApplicationDetails, saveCounselProfile } from '@/libs/accounts/CounselProfile';
import { Env } from '@/libs/Env';
import { institutionApplicationSchema } from '@/models/Schema';
import { parseAccount } from '@/utils/accounts/Account';
import { institutionKinds } from '@/utils/accounts/Institution';
import { createDbConnection } from '@/utils/DBConnection';

/**
 * Gives every organisation or lawyer who is waiting for review, and has no application on record, an application in review, so
 * staff see them in the queue. What they gave is read from their Clerk private metadata. A verified account with no application is
 * only listed, because inventing an approval would be a decision no staff member made. It does nothing until `--apply` is given, and
 * it sends no email. Run with:
 * `pnpm exec dotenv -c -- tsx scripts/backfill-applications.ts [--apply] [--email=a@b.c --kind=other --organisation="Name"]`.
 * The last three set the details for the one account with that email, when its Clerk metadata does not hold them.
 */
const apply = process.argv.includes('--apply');
const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const override = {
  email: flag('email')?.toLowerCase(),
  kind: z.enum(institutionKinds).optional().parse(flag('kind')),
  organisation: flag('organisation'),
};

const Details = z.object({
  firm: z.string().nullable().optional(),
  kind: z.enum(institutionKinds).optional(),
  registrationNumber: z.string().optional(),
  registrations: z.array(z.object({ jurisdiction: z.string() })).optional(),
});

const clerk = createClerkClient({ secretKey: Env.CLERK_SECRET_KEY });
const db = createDbConnection();
const rows = await db
  .select({ id: institutionApplicationSchema.userId })
  .from(institutionApplicationSchema);
const known = new Set(rows.map((row) => row.id));
const pageSize = 100;
let added = 0;

for (let offset = 0; ; offset += pageSize) {
  // oxlint-disable-next-line no-await-in-loop -- Clerk is read one page at a time
  const { data: users } = await clerk.users.getUserList({ limit: pageSize, offset });

  for (const user of users) {
    const account = parseAccount(user.publicMetadata);

    if (account?.accountType !== 'counsel' || known.has(user.id)) {
      continue;
    }

    const email = user.primaryEmailAddress?.emailAddress ?? user.id;

    if (account.review !== 'pending') {
      console.log(
        `SKIPPED ${email}: verified with no application on record; staff decide what to record.`,
      );
      continue;
    }

    const saved = Details.parse(user.privateMetadata);
    const mine = override.email !== undefined && override.email === email.toLowerCase();
    const details = {
      ...saved,
      kind: (mine ? override.kind : undefined) ?? saved.kind,
      firm: (mine ? override.organisation : undefined) ?? saved.firm,
    };

    console.log(
      `${apply ? 'ADDING' : 'WOULD ADD'} ${email}: ${details.kind ?? 'law_firm'}, ${details.firm ?? 'independent'}`,
    );

    if (apply) {
      // oxlint-disable-next-line no-await-in-loop -- one account at a time, so a failure stops at a known place
      await db.transaction(async (tx) => {
        await saveCounselProfile(tx, {
          userId: user.id,
          review: 'pending',
          kind: details.kind,
          firm: details.firm ?? null,
          jurisdictions: details.registrations?.map((entry) => entry.jurisdiction) ?? [],
        });
        await saveApplicationDetails(tx, {
          userId: user.id,
          kind: details.kind ?? 'law_firm',
          organisation: details.firm ?? null,
          registrationNumber: details.registrationNumber ?? '',
          website: null,
          contactRole: null,
        });
      });
    }

    added += 1;
  }

  if (users.length < pageSize) {
    break;
  }
}

console.log(
  `${added} application(s) ${apply ? 'added' : 'to add; run again with --apply to add them'}.`,
);
process.exit(0);
