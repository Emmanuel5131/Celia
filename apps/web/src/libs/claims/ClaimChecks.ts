import { isValidAddress } from '@celia/core';
import type { ChainId } from '@celia/core';
import { checkVideoLink } from '@/libs/claims/VideoLinkCheck';
import { walletActivity } from '@/libs/claims/WalletActivity';
import { needsLookup } from '@/utils/claims/ClaimEvidence';
import type {
  AddressCheck,
  EvidenceChecks,
  VideoCheck,
  WalletCheck,
} from '@/utils/claims/ClaimEvidence';
import { parseVideoLink } from '@/utils/claims/VideoLink';

type CheckedClaim = Parameters<typeof needsLookup>[0] & {
  id: string;
  chain: ChainId;
  walletAddress: string | null;
  destinationAddress: string | null;
};

// Public nodes and explorers rate-limit, so lookups run a few at a time.
const lookupsAtOnce = 24;

const addressesOf = (claim: CheckedClaim) =>
  [claim.walletAddress, claim.destinationAddress].flatMap((address) => address ?? []);

function checkAddresses(claim: CheckedClaim): AddressCheck {
  const addresses = addressesOf(claim);

  if (addresses.length === 0) {
    return 'none';
  }

  return addresses.every((address) => isValidAddress(claim.chain, address)) ? 'valid' : 'invalid';
}

async function checkWallet(claim: CheckedClaim): Promise<WalletCheck> {
  const addresses = addressesOf(claim);

  if (addresses.length === 0) {
    return 'none';
  }

  const answers = await Promise.all(
    addresses.map(async (address) => await walletActivity(claim.chain, address)),
  );

  // Either address having been used is a good sign; an address we could not ask about is not held against the claim.
  if (answers.includes('active')) {
    return 'active';
  }

  return answers.includes('unknown') ? 'unknown' : 'empty';
}

async function checkVideo(url: string | null | undefined): Promise<VideoCheck> {
  if (!url) {
    return 'none';
  }

  const link = parseVideoLink(url);

  return link ? await checkVideoLink(link) : 'invalid';
}

async function checkClaim(claim: CheckedClaim): Promise<EvidenceChecks> {
  const address = checkAddresses(claim);
  const [video, wallet] = await Promise.all([
    checkVideo(claim.proof?.videoUrl),
    // An invalid address has no activity to ask about, and a claim with a signature or a file is kept for that anyway.
    address === 'valid' && needsLookup(claim)
      ? checkWallet(claim)
      : Promise.resolve('none' as const),
  ]);

  return { address, video, wallet };
}

/**
 * Looks up what the evidence rule needs: whether each address is valid for its chain, whether a video link is a link that opens
 * and, for a claim with no signature or file, whether the wallet has been used.
 * @param claims - The waiting claims.
 * @returns What the checks said, by claim id.
 */
export async function gatherEvidenceChecks(claims: CheckedClaim[]) {
  const checks = new Map<string, EvidenceChecks>();

  for (let start = 0; start < claims.length; start += lookupsAtOnce) {
    const batch = claims.slice(start, start + lookupsAtOnce);
    // oxlint-disable-next-line no-await-in-loop -- a few lookups at a time, so public nodes are not flooded
    const results = await Promise.all(batch.map(async (claim) => await checkClaim(claim)));

    for (const [index, claim] of batch.entries()) {
      const result = results[index];

      if (result) {
        checks.set(claim.id, result);
      }
    }
  }

  return checks;
}
