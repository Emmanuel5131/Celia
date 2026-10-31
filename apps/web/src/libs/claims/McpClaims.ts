import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { claimSchema } from '@/models/Schema';
import { claimantLabel } from '@/utils/claims/ClaimResearch';

/** How many claims one page holds, so a long list is read in parts and never in one go. */
const mcpClaimsPageSize = 25;

/** The longest a claimant's account is cut to, so a page of them stays readable. */
const statementLimit = 1500;

/**
 * Lists claims for the MCP server, newest first, with what staff need to read them as a group and nothing that names a claimant:
 * no user id, name, email, wallet address, transaction hash or proof file. A claimant's own account is included only when asked,
 * because it is free text and can hold a name or a wallet; whoever reads it must not copy either anywhere.
 * @param options - What to list.
 * @param options.platformKey - Keep only the claims pooled under this platform key (a case).
 * @param options.search - Keep only the claims whose platform, person or group name, or contact handle, matches this text.
 * @param options.page - The page, from 1.
 * @param options.withAccounts - Include each claimant's own account of what happened.
 * @returns The claims on the page, how many match in all, and the page size.
 */
export async function listClaimsForMcp(options: {
  platformKey?: string;
  search?: string;
  page: number;
  withAccounts: boolean;
}) {
  const text = options.search?.trim() ?? '';
  // A `%` or `_` typed by staff is part of what they look for, not a wildcard.
  const pattern = `%${text.replaceAll(/[\\%_]/gu, String.raw`\$&`)}%`;
  const filters: (SQL | undefined)[] = [
    options.platformKey ? eq(claimSchema.platformKey, options.platformKey) : undefined,
    text === ''
      ? undefined
      : or(ilike(claimSchema.platformName, pattern), ilike(claimSchema.operatorHandle, pattern)),
  ];
  const where = and(...filters);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: claimSchema.id,
        platformName: claimSchema.platformName,
        platformHost: claimSchema.platformHost,
        operatorHandle: claimSchema.operatorHandle,
        fraudTypes: claimSchema.fraudTypes,
        paymentMethod: claimSchema.paymentMethod,
        chain: claimSchema.chain,
        amountLost: claimSchema.amountLost,
        contactChannel: claimSchema.contactChannel,
        firstPaymentOn: claimSchema.firstPaymentOn,
        lastPaymentOn: claimSchema.lastPaymentOn,
        submittedAt: claimSchema.submittedAt,
        validatedAt: claimSchema.validatedAt,
        rejectedAt: claimSchema.rejectedAt,
        statement: claimSchema.statement,
        fraudDescription: claimSchema.fraudDescription,
      })
      .from(claimSchema)
      .where(where)
      .orderBy(desc(claimSchema.submittedAt))
      .limit(mcpClaimsPageSize)
      .offset((options.page - 1) * mcpClaimsPageSize),
    db.select({ total: count() }).from(claimSchema).where(where),
  ]);

  return {
    total: total?.total ?? 0,
    page: options.page,
    pageSize: mcpClaimsPageSize,
    claims: rows.map(({ statement, fraudDescription, validatedAt, rejectedAt, ...claim }) => ({
      ...claim,
      claimant: claimantLabel(claim.id),
      state: (() => {
        if (validatedAt) {
          return 'confirmed';
        }

        return rejectedAt ? 'rejected' : 'sent';
      })(),
      submittedAt: claim.submittedAt?.toISOString() ?? null,
      ...(options.withAccounts && {
        account: (statement ?? fraudDescription ?? '').slice(0, statementLimit),
      }),
    })),
  };
}
