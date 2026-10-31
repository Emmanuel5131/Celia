/** The reason given when a claim comes with no signature, file or video and its wallet has no activity. */
export const lowEvidenceNote =
  'There was not enough evidence to confirm this claim: no wallet signature, file or video was added. A screenshot or a short video helps. Loom shows how to record one: https://www.loom.com/screen-recorder';

/** The reason given when an address in the claim is not valid for its chain. */
export const invalidAddressNote =
  'We could not confirm this claim: an address in it is not a valid address for the chain you chose. Check it against your wallet app.';

/** The reason given when the video link is not a link or does not open. */
export const badLinkNote =
  'We could not confirm this claim: the video link is not valid or did not open. A public link to a video helps. Loom shows how to record one: https://www.loom.com/screen-recorder';

/** What the lookups said of a video link: it opens, it is gone or not a link at all, it could not be asked, or the claim has none. */
export type VideoCheck = 'ok' | 'gone' | 'invalid' | 'unknown' | 'none';

/** What the chain says of a claim's addresses: some activity, none at all, no answer, or no address to ask about. */
export type WalletCheck = 'active' | 'empty' | 'unknown' | 'none';

/** Whether the addresses a claim gives are valid for its chain. One bad address makes it `invalid`. */
export type AddressCheck = 'valid' | 'invalid' | 'none';

export type EvidenceChecks = { address: AddressCheck; video: VideoCheck; wallet: WalletCheck };

type EvidenceClaim = {
  id: string;
  signed: boolean;
  state: 'sent' | 'in_review';
  proof: { videoUrl: string | null; files: unknown[] } | null;
};

/**
 * Whether a claim needs the wallet looked up on the chain to be judged. A claim with a signature or a file is already kept for its
 * evidence, so it costs none.
 * @param claim - The claim.
 * @returns True when the wallet has to be asked about.
 */
export function needsLookup(claim: Pick<EvidenceClaim, 'signed' | 'state' | 'proof'>) {
  return claim.state === 'sent' && !claim.signed && (claim.proof?.files.length ?? 0) === 0;
}

/**
 * Judges one waiting claim. An address that is not valid for its chain, or a video link that is not a link or is gone, turns it
 * down whatever else it has. Otherwise it is kept when any of its evidence is good: a signed wallet, a file, a video that opens or
 * a wallet with activity on the chain, and turned down only when none is. A lookup that could not be made counts as nothing
 * against the claim, and a claim a person has already started reviewing is always kept.
 * @param claim - The claim.
 * @param checks - What the lookups said.
 * @returns `keep`, or the reason to turn it down: `invalidAddress`, `badLink` or `nothing` (no signature, file or video).
 */
export function judgeEvidence(claim: EvidenceClaim, checks?: EvidenceChecks) {
  if (claim.state === 'in_review' || !checks) {
    return 'keep' as const;
  }

  if (checks.address === 'invalid') {
    return 'invalidAddress' as const;
  }

  if (checks.video === 'gone' || checks.video === 'invalid') {
    return 'badLink' as const;
  }

  if (!needsLookup(claim) || checks.video === 'ok' || checks.wallet === 'active') {
    return 'keep' as const;
  }

  return checks.wallet === 'unknown' || checks.video === 'unknown'
    ? ('keep' as const)
    : ('nothing' as const);
}

/**
 * Splits the claims waiting for staff into those to turn down, by reason, and those staff should look at.
 * @param claims - The waiting claims.
 * @param checks - What the lookups said, by claim id.
 * @returns The ids to turn down for each reason, and the ids to keep.
 */
export function splitByEvidence(
  claims: EvidenceClaim[],
  checks = new Map<string, EvidenceChecks>(),
) {
  const split = {
    invalidAddress: [] as string[],
    badLink: [] as string[],
    nothing: [] as string[],
    keep: [] as string[],
  };

  for (const claim of claims) {
    split[judgeEvidence(claim, checks.get(claim.id))].push(claim.id);
  }

  return split;
}
