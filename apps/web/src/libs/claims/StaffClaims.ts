import type { ChainId, FraudType } from '@celia/core';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getUsersById } from '@/libs/accounts/ClerkUsers';
import { listProofFilesFor } from '@/libs/claims/ClaimProofs';
import type { ProofFile } from '@/libs/claims/ClaimProofs';
import { signalsFor } from '@/libs/claims/Signals';
import { db } from '@/libs/DB';
import { claimSchema } from '@/models/Schema';
import { registerPageSize } from '@/utils/claims/ClaimRegister';
import type { RegisterState } from '@/utils/claims/ClaimRegister';
import { claimState } from '@/utils/claims/ClaimState';
import type { ClaimState } from '@/utils/claims/ClaimState';
import type { ClaimSignal } from '@/utils/claims/Signals';
import type { StoredCheck } from '@/utils/claims/Transaction';

/**
 * Everything the case bank holds about one claim, for staff. It is plain data for the browser. The nonce and the signature the
 * wallet made are left out on purpose: staff see that the wallet signed and when, not the secret material.
 */
export type ClaimRecord = {
  id: string;
  state: ClaimState;
  userId: string;
  name: string | null;
  email: string | null;
  fraudTypes: FraudType[];
  paymentMethod: string;
  chain: ChainId;
  walletAddress: string | null;
  txHash: string | null;
  platformName: string | null;
  platformKey: string | null;
  platformUrl: string | null;
  platformHost: string | null;
  operatorHandle: string | null;
  tokenName: string | null;
  tokenContract: string | null;
  fraudDescription: string | null;
  walletType: string | null;
  accountKind: string | null;
  walletApp: string | null;
  fundingTxHash: string | null;
  txCheck: StoredCheck | null;
  fundingTxCheck: StoredCheck | null;
  destinationAddress: string | null;
  assetSent: string | null;
  contactChannel: string | null;
  amountLost: string | null;
  statement: string | null;
  country: string | null;
  signed: boolean;
  ownershipMethod: string | null;
  signedAt: string | null;
  reviewVideoUrl: string | null;
  proofNote: string | null;
  reviewNote: string | null;
  rejectionNote: string | null;
  createdAt: string;
  consentedAt: string | null;
  submittedAt: string | null;
  staffReviewStartedAt: string | null;
  reviewRequestedAt: string | null;
  reviewedAt: string | null;
  validatedAt: string | null;
  rejectedAt: string | null;
  updatedAt: string | null;
  signals: ClaimSignal[];
  files: ProofFile[];
};

/**
 * The part of a query that keeps only the claims in one state. It mirrors `claimState`, so a filter and the state shown in a row
 * never disagree.
 * @param state - The state to keep.
 * @returns The condition, or nothing for `all`.
 */
function inState(state: RegisterState): SQL | undefined {
  const open = and(isNull(claimSchema.rejectedAt), isNull(claimSchema.validatedAt));

  switch (state) {
    case 'all': {
      return undefined;
    }
    case 'rejected': {
      return isNotNull(claimSchema.rejectedAt);
    }
    case 'accepted': {
      return and(isNull(claimSchema.rejectedAt), isNotNull(claimSchema.validatedAt));
    }
    case 'draft': {
      return and(open, ne(claimSchema.status, 'submitted'));
    }
    case 'sent': {
      return and(
        open,
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.staffReviewStartedAt),
      );
    }
    case 'in_review': {
      return and(
        open,
        eq(claimSchema.status, 'submitted'),
        isNotNull(claimSchema.staffReviewStartedAt),
      );
    }
    default: {
      return undefined;
    }
  }
}

/**
 * The part of a query that keeps the claims matching a search: the platform, the wallet, a transaction or the start of a claim id.
 * @param search - What staff typed; blank keeps every claim.
 * @returns The condition, or nothing for a blank search.
 */
function matching(search: string): SQL | undefined {
  const text = search.trim();

  if (text === '') {
    return undefined;
  }

  // A `%` or `_` typed by staff is part of what they look for, not a wildcard.
  const pattern = `%${text.replaceAll(/[\\%_]/gu, String.raw`\$&`)}%`;

  return or(
    ilike(claimSchema.platformName, pattern),
    ilike(claimSchema.walletAddress, pattern),
    ilike(claimSchema.txHash, pattern),
    ilike(claimSchema.fundingTxHash, pattern),
    sql`${claimSchema.id}::text ilike ${pattern}`,
  );
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

/**
 * One page of the register: every claim in the case bank, newest first, whatever state it is in, with all that is held about each.
 * It is for staff only: it carries claimants' names, emails, wallets and statements. Names and emails come from Clerk, and a
 * claimant Clerk does not know (a sample one) has none.
 * @param options - What to show.
 * @param options.state - Keep only the claims in this state.
 * @param options.search - Keep only the claims matching this text.
 * @param options.page - The page, from 1.
 * @returns The claims on the page and how many claims match in all.
 */
export async function listClaimRegister(options: {
  state: RegisterState;
  search: string;
  page: number;
}) {
  const where = and(inState(options.state), matching(options.search));
  // The nonce and the signature are never read, so they cannot reach a page by mistake.
  const { nonce: _nonce, signature: _signature, ...columns } = getTableColumns(claimSchema);
  const [rows, [total]] = await Promise.all([
    db
      .select(columns)
      .from(claimSchema)
      .where(where)
      .orderBy(desc(sql`coalesce(${claimSchema.submittedAt}, ${claimSchema.createdAt})`))
      .limit(registerPageSize)
      .offset((options.page - 1) * registerPageSize),
    db.select({ total: count() }).from(claimSchema).where(where),
  ]);
  const [signals, files, users] = await Promise.all([
    signalsFor(rows),
    listProofFilesFor(rows.map((row) => row.id)),
    getUsersById(rows.map((row) => row.userId)),
  ]);
  const records = rows.map((row): ClaimRecord => {
    const user = users.get(row.userId);

    return {
      id: row.id,
      state: claimState(row),
      userId: row.userId,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      fraudTypes: row.fraudTypes.length > 0 ? row.fraudTypes : [row.fraudType],
      paymentMethod: row.paymentMethod,
      chain: row.chain,
      walletAddress: row.walletAddress,
      txHash: row.txHash,
      platformName: row.platformName,
      platformKey: row.platformKey,
      platformUrl: row.platformUrl,
      platformHost: row.platformHost,
      operatorHandle: row.operatorHandle,
      tokenName: row.tokenName,
      tokenContract: row.tokenContract,
      fraudDescription: row.fraudDescription,
      walletType: row.walletType,
      accountKind: row.accountKind,
      walletApp: row.walletApp,
      fundingTxHash: row.fundingTxHash,
      txCheck: row.txCheck,
      fundingTxCheck: row.fundingTxCheck,
      destinationAddress: row.destinationAddress,
      assetSent: row.assetSent,
      contactChannel: row.contactChannel,
      amountLost: row.amountLost,
      statement: row.statement,
      country: row.country,
      signed: row.ownership === 'signed',
      ownershipMethod: row.ownershipMethod,
      signedAt: iso(row.signedAt),
      reviewVideoUrl: row.reviewVideoUrl,
      proofNote: row.proofNote,
      reviewNote: row.reviewNote,
      rejectionNote: row.rejectionNote,
      createdAt: row.createdAt.toISOString(),
      consentedAt: iso(row.consentedAt),
      submittedAt: iso(row.submittedAt),
      staffReviewStartedAt: iso(row.staffReviewStartedAt),
      reviewRequestedAt: iso(row.reviewRequestedAt),
      reviewedAt: iso(row.reviewedAt),
      validatedAt: iso(row.validatedAt),
      rejectedAt: iso(row.rejectedAt),
      updatedAt: iso(row.updatedAt),
      signals: signals.get(row.id) ?? [],
      files: files.get(row.id) ?? [],
    };
  });

  return { records, total: total?.total ?? 0 };
}
