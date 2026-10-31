'use server';

import type { AccountKind } from '@celia/core';
import {
  canVerifyOwnership,
  paidOnChain,
  ownershipMessage,
  platformHost,
  platformKey,
  verifyOwnership,
} from '@celia/core';
import { auth, currentUser } from '@clerk/nextjs/server';
import { and, count, eq, inArray, isNull, ne } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type * as z from 'zod';
import { mustVerify } from '@/libs/accounts/Identity';
import { refreshStoriesForClaims } from '@/libs/cases/CaseStory';
import { detectAccountKind } from '@/libs/claims/AccountKind';
import {
  checkExtraTransactions,
  deleteClaimExtras,
  listClaimExtras,
  replaceClaimExtras,
} from '@/libs/claims/ClaimExtras';
import { listProofFiles } from '@/libs/claims/ClaimProofs';
import { getClaim } from '@/libs/claims/Claims';
import { removeFollowUp, saveFollowUp } from '@/libs/claims/FollowUp';
import { countSentToday } from '@/libs/claims/Signals';
import { checkClaimTransactions } from '@/libs/claims/TxChecks';
import { db } from '@/libs/DB';
import { notify } from '@/libs/notifications/Notify';
import { saveLocale } from '@/libs/notifications/UserSettings';
import { claimProofSchema, claimRevisionSchema, claimSchema } from '@/models/Schema';
import { parseAccount } from '@/utils/accounts/Account';
import { claimChanges } from '@/utils/claims/ClaimChanges';
import { claimState } from '@/utils/claims/ClaimState';
import { cleanFileName, detectProofType, proofFileLimits } from '@/utils/claims/ProofFile';
import { maxClaimsPerDay } from '@/utils/claims/Signals';
import { parseVideoLink } from '@/utils/claims/VideoLink';
import { getI18nPath } from '@/utils/Helpers';
import {
  CreateClaimValidation,
  SignatureValidation,
  StatementValidation,
} from '@/validations/ClaimValidation';
import { FollowUpValidation } from '@/validations/FollowUpValidation';

export type ClaimState = {
  /** The names of the fields that failed, or a reason such as `duplicate` or `signature`. */
  errors: string[];
  /** Set when the action succeeded and stays on the page. */
  done?: boolean;
};

const failed = (errors: string[]): ClaimState => ({ errors });

const text = (formData: FormData, name: string) => formData.get(name) ?? undefined;

/**
 * Finds the signed-in person and refuses anyone who is not a `person` account: counsel cannot file claims.
 * @returns The user id and the Clerk user, or a redirect to the dashboard.
 */
async function requirePerson() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || parseAccount(user?.publicMetadata)?.accountType !== 'person') {
    return redirect(getI18nPath('/dashboard', await getLocale()));
  }

  return { userId, user };
}

/**
 * Reads the rows of one list of extra wallets or transactions: a chain and a value for each, with empty rows dropped.
 * @param formData - The submitted form.
 * @param name - The list's field name.
 * @returns The rows.
 */
function readRows(formData: FormData, name: string) {
  const chains = formData.getAll(`${name}Chain`);

  return formData
    .getAll(`${name}Value`)
    .flatMap((value, index) =>
      typeof value === 'string' && value.trim() !== '' ? [{ chain: chains[index], value }] : [],
    );
}

const names = [
  'paymentMethod',
  'chain',
  'walletType',
  'walletApp',
  'fundingTxHash',
  'destinationAddress',
  'firstPaymentOn',
  'lastPaymentOn',
  'assetSent',
  'walletAddress',
  'txHash',
  'unknownOperator',
  'platformName',
  'platformUrl',
  'operatorHandle',
  'tokenContract',
  'tokenName',
  'fraudDescription',
  'contactChannel',
  'amountLost',
] as const;

/**
 * Reads the new-claim form into the shape the validation expects. An empty answer, such as an unchosen "how did it start?",
 * is left out.
 * @param formData - The submitted form.
 * @returns The raw input.
 */
function readClaimForm(formData: FormData) {
  // Every kind of loss the person ticked, not just the first.
  const input: Record<string, unknown> = {
    fraudTypes: formData.getAll('fraudType'),
  };

  for (const name of names) {
    const value = formData.get(name);

    if (value !== null && value !== '') {
      input[name] = value;
    }
  }

  // Extra wallets and transactions come as rows, each with its own chain; an empty row is left out.
  for (const name of ['moreAffected', 'moreReceiving', 'moreTransactions']) {
    input[name] = readRows(formData, name);
  }

  return input;
}

type NewClaim = z.infer<typeof CreateClaimValidation>;

// A list of extra wallets or transactions as sorted text, so two lists with the same entries compare as equal.
const pack = (rows: { chain: string; value: string }[]) =>
  rows.map((row) => `${row.chain}:${row.value}`).toSorted();

const extrasOf = (claim: NewClaim) => ({
  affected: claim.moreAffected,
  receiving: claim.moreReceiving,
  transactions: claim.moreTransactions,
});

/**
 * Finds a claim this person has already filed for the same wallet and operator, or for the same transaction.
 * @param input - What to compare.
 * @param input.userId - The Clerk user id.
 * @param input.claim - The validated new claim.
 * @param input.key - The operator's pooling key, or an empty string when unnamed.
 * @param input.exceptId - A claim to leave out, so a claim being edited does not match itself.
 * @returns The earlier claim's id, if there is one.
 */
async function findDuplicate(input: {
  userId: string;
  claim: NewClaim;
  key: string;
  exceptId?: string;
}) {
  const { userId, claim, key } = input;

  // A claim with no wallet and no transaction has nothing to compare, so it can never repeat another.
  if (claim.paymentMethod !== 'wallet' && !claim.txHash) {
    return null;
  }

  const same =
    claim.paymentMethod === 'wallet'
      ? and(
          eq(claimSchema.chain, claim.chain),
          eq(claimSchema.walletAddress, claim.walletAddress ?? ''),
          key ? eq(claimSchema.platformKey, key) : isNull(claimSchema.platformKey),
        )
      : eq(claimSchema.txHash, claim.txHash ?? '');
  const [existing] = await db
    .select({ id: claimSchema.id })
    .from(claimSchema)
    .where(
      and(
        eq(claimSchema.userId, userId),
        same,
        input.exceptId ? ne(claimSchema.id, input.exceptId) : undefined,
      ),
    );

  return existing;
}

/**
 * What is kept about the wallet, only when the money left from the person's own wallet. For an exchange, an ATM or a person
 * there is no wallet to describe.
 * @param claim - The validated new claim.
 * @param accountKind - What the chain says the wallet is, if it could be read.
 * @returns The wallet columns.
 */
function walletColumns(claim: NewClaim, accountKind: AccountKind | null) {
  const own = claim.paymentMethod === 'wallet';

  return {
    accountKind: own ? accountKind : null,
    walletAddress: own ? (claim.walletAddress ?? null) : null,
    walletType: own ? (claim.walletType ?? null) : null,
    walletApp: own ? (claim.walletApp ?? null) : null,
    fundingTxHash: own ? (claim.fundingTxHash ?? null) : null,
  };
}

/**
 * What is kept about the payment itself: the transaction, where the money went, when and what was sent.
 * @param claim - The validated new claim.
 * @returns The payment columns.
 */
function paymentColumns(claim: NewClaim) {
  return {
    txHash: claim.txHash ?? null,
    destinationAddress: claim.destinationAddress ?? null,
    firstPaymentOn: claim.firstPaymentOn ?? null,
    lastPaymentOn: claim.lastPaymentOn ?? null,
    assetSent: claim.assetSent ?? null,
  };
}

/**
 * Turns a validated claim into the row to store. The operator's name, website host and token contract are normalised here so
 * claims about the same operator can be pooled.
 * @param claim - The validated new claim.
 * @param named - The operator's name, if known.
 * @param accountKind - What the chain says the wallet is, if it could be read.
 * @returns The columns, except the owner and the country.
 */
function claimColumns(claim: NewClaim, named: string | undefined, accountKind: AccountKind | null) {
  const key = named ? platformKey(named) : '';

  return {
    fraudType: claim.fraudTypes[0] ?? 'other',
    fraudTypes: [...new Set(claim.fraudTypes)],
    paymentMethod: claim.paymentMethod,
    chain: claim.chain,
    ...walletColumns(claim, accountKind),
    ...paymentColumns(claim),
    platformName: named ?? null,
    platformKey: key === '' ? null : key,
    platformUrl: claim.platformUrl ?? null,
    platformHost: claim.platformUrl ? (platformHost(claim.platformUrl) ?? null) : null,
    operatorHandle: claim.operatorHandle ?? null,
    tokenContract: claim.tokenContract?.toLowerCase() ?? null,
    tokenName: claim.tokenName ?? null,
    // Only kept when the person said none of the listed kinds fitted.
    fraudDescription: claim.fraudTypes.includes('other') ? (claim.fraudDescription ?? null) : null,
    contactChannel: claim.contactChannel ?? null,
    amountLost: claim.amountLost ?? null,
    nonce: crypto.randomUUID(),
  };
}

/**
 * What the chain shows for the transactions in a validated claim, to keep with it. A bank or card payment has no chain, and only
 * a wallet payment has a wallet or a funding transaction, so nothing else is asked about.
 * @param claim - The validated claim.
 * @returns The checks to keep.
 */
async function claimChecks(claim: NewClaim) {
  const own = claim.paymentMethod === 'wallet';

  return await checkClaimTransactions({
    chain: claim.chain,
    walletAddress: own ? claim.walletAddress : null,
    txHash: paidOnChain(claim.paymentMethod) ? claim.txHash : null,
    fundingTxHash: own ? claim.fundingTxHash : null,
  });
}

/**
 * Starts a claim: checks what happened, how it was paid and who took the money, and creates a draft. The one-time nonce for
 * the ownership message is made here, so it cannot be chosen by the person. Filing the same wallet for the same operator, or
 * the same transaction, twice is refused.
 * @param _state - The previous state (unused).
 * @param formData - The submitted form.
 * @returns The failed fields; on success it redirects to the claim.
 */
export async function createClaim(_state: ClaimState, formData: FormData): Promise<ClaimState> {
  const { userId, user } = await requirePerson();

  // Reporting is for people who have passed the one-time identity check.
  if (await mustVerify(userId)) {
    return failed(['identity']);
  }

  const parsed = CreateClaimValidation.safeParse(readClaimForm(formData));

  if (!parsed.success) {
    return failed([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  }

  const claim = parsed.data;
  const named = claim.unknownOperator === 'on' ? undefined : claim.platformName;

  if (await findDuplicate({ userId, claim, key: named ? platformKey(named) : '' })) {
    return failed(['duplicate']);
  }

  // Read from the chain, never asked: whether the wallet is a regular one or a smart contract wallet.
  const accountKind =
    claim.paymentMethod === 'wallet' && claim.walletAddress
      ? await detectAccountKind(claim.chain, claim.walletAddress)
      : null;
  const country = user?.privateMetadata.country;
  const extras = extrasOf(claim);
  const extraChecks = await checkExtraTransactions(extras.transactions, claim.walletAddress ?? '');
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(claimSchema)
      .values({
        ...claimColumns(claim, named, accountKind),
        ...(await claimChecks(claim)),
        userId,
        country: typeof country === 'string' ? country : null,
      })
      .returning({ id: claimSchema.id });

    if (row) {
      await replaceClaimExtras(tx, row.id, extras, extraChecks);
    }

    return row;
  });

  return redirect(getI18nPath(`/dashboard/claims/${created?.id}`, await getLocale()));
}

/**
 * Saves the first page of a claim again, from the same form. A different chain, address or way of
 * paying clears the ownership proof and makes a new nonce, because the signed message names the wallet; every other change keeps
 * it. A claim that was already sent can be edited too: what changed is kept in `claim_revision`, and a real change sends it back
 * to be reviewed again, since staff accepted what it said before.
 * @param claimId - The claim.
 * @param _state - The previous state (unused).
 * @param formData - The submitted form.
 * @returns The failed fields; on success it redirects to the claim.
 */
export async function updateClaim(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const existing = await getClaim(userId, claimId);

  if (!existing) {
    return failed(['claim']);
  }

  const parsed = CreateClaimValidation.safeParse(readClaimForm(formData));

  if (!parsed.success) {
    return failed([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  }

  const claim = parsed.data;
  const named = claim.unknownOperator === 'on' ? undefined : claim.platformName;

  if (
    await findDuplicate({
      userId,
      claim,
      key: named ? platformKey(named) : '',
      exceptId: existing.id,
    })
  ) {
    return failed(['duplicate']);
  }

  const moved =
    claim.paymentMethod !== existing.paymentMethod ||
    claim.chain !== existing.chain ||
    (claim.paymentMethod === 'wallet' ? (claim.walletAddress ?? null) : null) !==
      existing.walletAddress;
  const walletKind =
    claim.paymentMethod === 'wallet' && claim.walletAddress
      ? await detectAccountKind(claim.chain, claim.walletAddress)
      : null;
  const { nonce, ...columns } = claimColumns(
    claim,
    named,
    moved ? walletKind : existing.accountKind,
  );

  // A claim that was already sent can be edited too. What changed is kept, and a real change sends it back to be reviewed again,
  // because staff accepted what it said before.
  const sent = existing.status === 'submitted';
  const extras = extrasOf(claim);
  const current = await listClaimExtras(existing.id);
  const changes = sent
    ? claimChanges(
        {
          ...existing,
          moreAffected: pack(
            current.affected.map((row) => ({ chain: row.chain, value: row.address })),
          ),
          moreReceiving: pack(
            current.receiving.map((row) => ({ chain: row.chain, value: row.address })),
          ),
          moreTransactions: pack(
            current.transactions.map((row) => ({ chain: row.chain, value: row.hash })),
          ),
        },
        {
          ...columns,
          moreAffected: pack(extras.affected),
          moreReceiving: pack(extras.receiving),
          moreTransactions: pack(extras.transactions),
        },
      )
    : {};
  const changed = Object.keys(changes).length > 0;
  const extraChecks = await checkExtraTransactions(extras.transactions, claim.walletAddress ?? '');

  const checks = await claimChecks(claim);

  await db.transaction(async (tx) => {
    await tx
      .update(claimSchema)
      .set({
        ...columns,
        ...checks,
        updatedAt: new Date(),
        ...(sent &&
          changed && {
            validatedAt: null,
            staffReviewStartedAt: null,
            rejectedAt: null,
            rejectionNote: null,
          }),
        // A different wallet needs its own proof; the same wallet keeps the one it has.
        ...(moved && {
          nonce,
          ownership: 'unsigned',
          ownershipMethod: null,
          signature: null,
          signedAt: null,
          reviewVideoUrl: null,
          proofNote: null,
          reviewNote: null,
          reviewRequestedAt: null,
          reviewedAt: null,
        }),
      })
      .where(
        and(
          eq(claimSchema.id, existing.id),
          eq(claimSchema.userId, userId),
          eq(claimSchema.status, existing.status),
        ),
      );

    // The documents named the old wallet, so they go with it.
    if (moved) {
      await tx.delete(claimProofSchema).where(eq(claimProofSchema.claimId, existing.id));
    }

    await replaceClaimExtras(tx, existing.id, extras, extraChecks);

    if (sent && changed) {
      await tx.insert(claimRevisionSchema).values({
        claimId: existing.id,
        userId,
        changes,
        stateBefore: claimState(existing),
      });
    }
  });

  const locale = await getLocale();
  revalidatePath(getI18nPath(`/dashboard/claims/${existing.id}`, locale));

  return redirect(getI18nPath(`/dashboard/claims/${existing.id}`, locale));
}

/**
 * Checks the signature a person pasted against their wallet and, if it matches, marks ownership as proven. A wrong signature
 * changes nothing.
 * @param claimId - The claim being proven.
 * @param _state - The previous state (unused).
 * @param formData - The submitted form.
 * @returns `done` when the wallet is confirmed; otherwise the reason.
 */
export async function verifyClaimOwnership(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await getClaim(userId, claimId);
  const parsed = SignatureValidation.safeParse({ signature: text(formData, 'signature') });

  if (!claim?.walletAddress) {
    return failed(['claim']);
  }

  if (!parsed.success) {
    return failed(['signature']);
  }

  const { chain } = claim;

  if (!canVerifyOwnership(chain)) {
    return failed(['unsupported']);
  }

  const message = ownershipMessage({ chain, address: claim.walletAddress, nonce: claim.nonce });

  if (
    !verifyOwnership({
      chain,
      address: claim.walletAddress,
      message,
      signature: parsed.data.signature,
    })
  ) {
    return failed(['signature']);
  }

  const locale = await getLocale();
  await saveLocale(userId, locale);
  await db.transaction(async (tx) => {
    await tx
      .update(claimSchema)
      .set({
        ownership: 'signed',
        ownershipMethod: 'signature',
        signature: parsed.data.signature,
        signedAt: new Date(),
        reviewNote: null,
      })
      .where(eq(claimSchema.id, claim.id));
    await notify(tx, [
      {
        userId,
        type: 'ownership_confirmed',
        dedupeKey: `ownership_confirmed:${claim.id}`,
        data: { claimId: claim.id },
      },
    ]);
  });
  await refreshStoriesForClaims([claim.id]);
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, locale));

  return { errors: [], done: true };
}

// The note to staff: nothing is fine, more than 1000 characters is not.
function readNote(formData: FormData) {
  const value = text(formData, 'note');
  const note = typeof value === 'string' ? value.trim() : '';

  return note.length > 1000 ? null : note;
}

/**
 * Finds a wallet claim the person can add evidence to. A claim already confirmed by signature can still take a video and files,
 * which staff look at as well.
 * @param userId - The signed-in person.
 * @param claimId - The claim.
 * @returns The claim, or undefined.
 */
async function openToProof(userId: string, claimId: string) {
  const claim = await getClaim(userId, claimId);

  return claim?.paymentMethod === 'wallet' ? claim : undefined;
}

/**
 * What to save when a video or files are added: the claim goes in the staff queue again, and a wallet not yet confirmed waits for
 * review. A wallet already confirmed stays confirmed. An earlier decline no longer applies. A claim staff already accepted goes
 * back to be reviewed, because the proof is looked at together with the claim.
 * @param claim - The claim.
 * @param note - What the person wrote, if anything. It replaces the earlier note only when there is one.
 * @returns The columns to set.
 */
function forReview(
  claim: Pick<typeof claimSchema.$inferSelect, 'ownership' | 'status' | 'validatedAt'>,
  note: string,
) {
  return {
    ...(claim.ownership === 'signed' ? {} : { ownership: 'review' }),
    ...(claim.status === 'submitted' &&
      claim.validatedAt !== null && { validatedAt: null, staffReviewStartedAt: null }),
    ...(note ? { proofNote: note } : {}),
    reviewRequestedAt: new Date(),
    reviewedAt: null,
    reviewNote: null,
  };
}

/**
 * Sends screenshots or receipts that show the person controls the wallet, for staff to look at. Each file is checked by what it
 * really is, not what it is called. They add to anything else the person gave: a signature, a video. Counsel never see the files.
 * @param claimId - The claim.
 * @param _state - The previous state (unused).
 * @param formData - The files and an optional note.
 * @returns `done` when sent; otherwise `files`, `files_type`, `files_size`, `files_count` or `note`.
 */
export async function sendOwnershipProof(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await openToProof(userId, claimId);
  const files = formData
    .getAll('files')
    .filter((file): file is File => file instanceof File && file.size > 0);
  const note = readNote(formData);

  if (!claim) {
    return failed(['claim']);
  }

  if (note === null) {
    return failed(['note']);
  }

  if (files.length === 0) {
    return failed(['files']);
  }

  if (files.some((file) => file.size > proofFileLimits.bytes)) {
    return failed(['files_size']);
  }

  const kept = await listProofFiles(claim.id);

  if (
    files.length > proofFileLimits.perSend ||
    kept.length + files.length > proofFileLimits.perClaim
  ) {
    return failed(['files_count']);
  }

  const rows = await Promise.all(
    files.map(async (file) => {
      const data = Buffer.from(await file.arrayBuffer());

      return {
        claimId: claim.id,
        name: cleanFileName(file.name),
        data,
        type: detectProofType(data),
      };
    }),
  );

  if (rows.some((row) => row.type === null)) {
    return failed(['files_type']);
  }

  await db.transaction(async (tx) => {
    await tx.insert(claimProofSchema).values(
      rows.map((row) => ({
        claimId: row.claimId,
        name: row.name,
        data: row.data,
        size: row.data.length,
        contentType: row.type ?? 'application/pdf',
      })),
    );
    await tx.update(claimSchema).set(forReview(claim, note)).where(eq(claimSchema.id, claim.id));
  });
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));

  return { errors: [], done: true };
}

/**
 * Sends a link to a video the person made to explain their case and show their wallet, for staff to watch. The video stays where
 * the person put it; only the link is kept. Counsel never see it.
 * @param claimId - The claim.
 * @param _state - The previous state (unused).
 * @param formData - The link and an optional note.
 * @returns `done` when sent; otherwise `link` or `note`.
 */
export async function sendOwnershipVideo(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await openToProof(userId, claimId);
  const note = readNote(formData);
  const linkValue = text(formData, 'link');
  const link = parseVideoLink(typeof linkValue === 'string' ? linkValue : '');

  if (!claim) {
    return failed(['claim']);
  }

  if (!link) {
    return failed(['link']);
  }

  if (note === null) {
    return failed(['note']);
  }

  await db
    .update(claimSchema)
    .set({ ...forReview(claim, note), reviewVideoUrl: link })
    .where(eq(claimSchema.id, claim.id));
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));

  return { errors: [], done: true };
}

/**
 * Takes back the video and files that staff have not looked at yet: the files are deleted and the link is forgotten. A wallet
 * that was waiting only on them goes back to unconfirmed; one confirmed by signature stays confirmed.
 * @param claimId - The claim.
 * @returns `done` when withdrawn.
 */
export async function withdrawOwnershipReview(claimId: string): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await getClaim(userId, claimId);

  if (!claim?.reviewRequestedAt) {
    return failed(['claim']);
  }

  await db.transaction(async (tx) => {
    await tx.delete(claimProofSchema).where(eq(claimProofSchema.claimId, claim.id));
    await tx
      .update(claimSchema)
      .set({
        ownership: claim.ownership === 'review' ? 'unsigned' : claim.ownership,
        reviewVideoUrl: null,
        proofNote: null,
        reviewRequestedAt: null,
        reviewedAt: null,
      })
      .where(eq(claimSchema.id, claim.id));
  });
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));

  return { errors: [], done: true };
}

/**
 * Removes one thing the person added to show the wallet is theirs: the video, or one file. When nothing is left, the claim leaves
 * the staff queue, and a wallet that was waiting only on it goes back to unconfirmed. A wallet confirmed by signature stays confirmed.
 * @param claimId - The claim.
 * @param target - `video`, or `file` with the file's id.
 * @param target.kind - What to remove.
 * @param target.proofId - The file, when removing a file.
 * @returns `done` when removed.
 */
export async function removeOwnershipEvidence(
  claimId: string,
  target: { kind: 'video' | 'file'; proofId?: string },
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await openToProof(userId, claimId);

  if (!claim) {
    return failed(['claim']);
  }

  await db.transaction(async (tx) => {
    if (target.kind === 'video') {
      await tx
        .update(claimSchema)
        .set({ reviewVideoUrl: null })
        .where(eq(claimSchema.id, claim.id));
    } else if (target.proofId) {
      await tx
        .delete(claimProofSchema)
        .where(
          and(eq(claimProofSchema.id, target.proofId), eq(claimProofSchema.claimId, claim.id)),
        );
    }

    const [left] = await tx
      .select({ files: count() })
      .from(claimProofSchema)
      .where(eq(claimProofSchema.claimId, claim.id));
    const [now] = await tx
      .select({ video: claimSchema.reviewVideoUrl })
      .from(claimSchema)
      .where(eq(claimSchema.id, claim.id));

    if ((left?.files ?? 0) === 0 && !now?.video) {
      await tx
        .update(claimSchema)
        .set({
          ownership: claim.ownership === 'review' ? 'unsigned' : claim.ownership,
          proofNote: null,
          reviewRequestedAt: null,
          reviewedAt: null,
        })
        .where(eq(claimSchema.id, claim.id));
    }
  });
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));

  return { errors: [], done: true };
}

/**
 * Saves what the person says happened. It can be edited after the claim is sent.
 * @param claimId - The claim.
 * @param _state - The previous state (unused).
 * @param formData - The submitted form.
 * @returns `done` when saved; otherwise the failed field.
 */
export async function saveStatement(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await getClaim(userId, claimId);
  const parsed = StatementValidation.safeParse({ statement: text(formData, 'statement') });

  if (!claim) {
    return failed(['claim']);
  }

  if (!parsed.success) {
    return failed(['statement']);
  }

  await db
    .update(claimSchema)
    .set({ statement: parsed.data.statement })
    .where(eq(claimSchema.id, claim.id));
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));

  return { errors: [], done: true };
}

/**
 * Sends the claim. It needs the person's account of what happened. Ownership may still be unconfirmed (an exchange account
 * cannot sign, and some chains cannot be checked yet); the file then shows it as not confirmed.
 * @param claimId - The claim.
 * @param _state - The previous state (unused).
 * @param formData - The submitted form: `consent`, `connect` and `truthful` must be on; `contact` is optional.
 * @returns `done` when sent; otherwise `statement` if the account is missing, `consent`, `connect` or `truthful` if the person has
 * not agreed, or `limit` if they have sent the most claims allowed in a day.
 */
export async function submitClaim(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await getClaim(userId, claimId);

  if (!claim) {
    return failed(['claim']);
  }

  if (!claim.statement) {
    return failed(['statement']);
  }

  if (formData.get('consent') !== 'on') {
    return failed(['consent']);
  }

  if (formData.get('connect') !== 'on') {
    return failed(['connect']);
  }

  if (formData.get('truthful') !== 'on') {
    return failed(['truthful']);
  }

  // A real victim has a handful of claims; a script has hundreds.
  if ((await countSentToday(userId)) >= maxClaimsPerDay) {
    return failed(['limit']);
  }

  const locale = await getLocale();
  await saveLocale(userId, locale);
  await db.transaction(async (tx) => {
    await tx
      .update(claimSchema)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        consentedAt: new Date(),
        // Optional and separate from the consent above: the person may say no and still send the claim.
        contactAgreedAt: formData.get('contact') === 'on' ? new Date() : null,
      })
      .where(eq(claimSchema.id, claim.id));

    await notify(tx, [
      {
        userId,
        type: 'claim_submitted',
        dedupeKey: `claim_submitted:${claim.id}`,
        data: { claimId: claim.id },
      },
    ]);
  });
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, locale));

  return { errors: [], done: true };
}

/**
 * Saves how the person wants Celia to follow up on a claim they have sent. It is private to them and to staff, and is shared with
 * no one unless they explicitly agree. A claim that is still a draft has no follow-up.
 * @param claimId - The claim.
 * @param _state - The previous state (unused).
 * @param formData - The submitted form: `channel`, `value` for a phone or messaging app, and an optional `bestTime`.
 * @returns `done` when saved; otherwise `claim`, or the names of the fields that failed.
 */
export async function saveFollowUpDetails(
  claimId: string,
  _state: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const claim = await getClaim(userId, claimId);

  if (claim?.status !== 'submitted') {
    return failed(['claim']);
  }

  const parsed = FollowUpValidation.safeParse({
    channel: text(formData, 'channel'),
    value: text(formData, 'value'),
    bestTime: text(formData, 'bestTime'),
  });

  if (!parsed.success) {
    return failed([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  }

  await saveFollowUp(claim.id, parsed.data);
  revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));

  return { errors: [], done: true };
}

/**
 * Deletes what the person gave for follow-up on one of their claims.
 * @param claimId - The claim.
 */
export async function removeFollowUpDetails(claimId: string) {
  const { userId } = await requirePerson();
  const claim = await getClaim(userId, claimId);

  if (claim) {
    await removeFollowUp(claim.id);
    revalidatePath(getI18nPath(`/dashboard/claims/${claim.id}`, await getLocale()));
  }
}

/**
 * Deletes the person's own drafts among the given claims, with the extra wallets and transactions each one holds. Anything that is
 * not their draft is skipped, so a claim sent a moment ago is never deleted; the check is part of the delete itself.
 * @param userId - The Clerk user id.
 * @param claimIds - The claims to delete.
 * @returns How many were deleted.
 */
async function deleteDraftsOf(userId: string, claimIds: string[]) {
  return await db.transaction(async (tx) => {
    const drafts = await tx
      .select({ id: claimSchema.id })
      .from(claimSchema)
      .where(
        and(
          inArray(claimSchema.id, claimIds),
          eq(claimSchema.userId, userId),
          eq(claimSchema.status, 'draft'),
        ),
      );
    const found = drafts.map((draft) => draft.id);

    if (found.length === 0) {
      return 0;
    }

    await deleteClaimExtras(tx, found);
    await tx.delete(claimSchema).where(inArray(claimSchema.id, found));

    return found.length;
  });
}

/**
 * Deletes a draft claim. Only the person's own draft can go: a claim that has been sent is part of a case and is never deleted
 * here. The check is part of the delete itself, so a claim sent a moment ago cannot slip through.
 * @param claimId - The claim.
 * @returns The failure when there was no such draft; otherwise it redirects to the list of claims.
 */
export async function deleteClaim(claimId: string): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const deleted = await deleteDraftsOf(userId, [claimId]);

  if (deleted === 0) {
    return failed(['claim']);
  }

  const locale = await getLocale();
  revalidatePath(getI18nPath('/dashboard/claims', locale));

  return redirect(getI18nPath('/dashboard/claims', locale));
}

/**
 * Deletes several of the person's own drafts at once. Anything that is not their draft is skipped, so a claim sent a moment ago
 * is never deleted.
 * @param claimIds - The claims to delete.
 * @returns The failure when none of them could be deleted.
 */
export async function deleteDrafts(claimIds: string[]): Promise<ClaimState> {
  const { userId } = await requirePerson();
  const deleted = await deleteDraftsOf(userId, claimIds);

  if (deleted === 0) {
    return failed(['claim']);
  }

  revalidatePath(getI18nPath('/dashboard/claims', await getLocale()));

  return { errors: [], done: true };
}
