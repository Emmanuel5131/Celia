import { isValidAddress, isValidTxHash } from './chains/address';
import type { ChainId } from './chains/chains';

/**
 * Where a piece of evidence comes from. A statement the platform made is off chain too, but it keeps its own table because the
 * research notebook reads it; everything else a case rests on is listed here.
 */
export const evidenceSources = ['off_chain', 'on_chain'] as const;

export type EvidenceSource = (typeof evidenceSources)[number];

/** Off-chain evidence: a file kept on IPFS, or a link to a page. */
export const offChainTypes = ['video', 'image', 'document', 'link'] as const;

/** On-chain evidence that is a reference the chain shows: a wallet or a transaction. */
export const referenceTypes = ['wallet', 'transaction'] as const;

/** On-chain evidence that is analysis of the chain, kept at a link: a Sandworm notebook or chat, or a Python or other script. */
export const analysisTypes = ['notebook', 'chat', 'script'] as const;

/** On-chain evidence: what the chain shows, or the analysis that reads it. */
export const onChainTypes = [...referenceTypes, ...analysisTypes] as const;

export const evidenceTypes = [...offChainTypes, ...onChainTypes] as const;

export type EvidenceType = (typeof evidenceTypes)[number];

/** The file types staff may upload, and the kind of evidence each one is. */
export const evidenceFileTypes = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'application/pdf': 'document',
} as const satisfies Record<string, EvidenceType>;

export type EvidenceFileType = keyof typeof evidenceFileTypes;

/** The largest file staff may upload. */
export const maxEvidenceFileBytes = 50 * 1024 * 1024;

/**
 * Which source a type belongs to.
 * @param type - The evidence type.
 * @returns `on_chain` for a wallet, a transaction or an analysis of the chain, otherwise `off_chain`.
 */
export function sourceOf(type: EvidenceType): EvidenceSource {
  return (onChainTypes as readonly string[]).includes(type) ? 'on_chain' : 'off_chain';
}

/**
 * Whether a type is a wallet or a transaction, which needs a chain and a reference, and not a link.
 * @param type - The evidence type.
 * @returns True for `wallet` and `transaction`.
 */
export function isReferenceType(type: EvidenceType): type is (typeof referenceTypes)[number] {
  return (referenceTypes as readonly string[]).includes(type);
}

/**
 * Whether a type is analysis kept at a link, which needs that link.
 * @param type - The evidence type.
 * @returns True for a notebook, a chat or a script.
 */
export function isAnalysisType(type: EvidenceType): type is (typeof analysisTypes)[number] {
  return (analysisTypes as readonly string[]).includes(type);
}

/**
 * Whether a file's media type may be uploaded.
 * @param mime - The media type the browser reports.
 * @returns True when it is one of the allowed types.
 */
export function isEvidenceFileType(mime: string): mime is EvidenceFileType {
  return Object.hasOwn(evidenceFileTypes, mime);
}

/**
 * Whether the reference of on-chain evidence is well formed for its chain.
 * @param options - What to check.
 * @param options.type - `wallet` or `transaction`.
 * @param options.chain - The chain.
 * @param options.reference - The address or transaction hash.
 * @returns True when the format is valid for the chain.
 */
export function isValidChainReference(options: {
  type: 'wallet' | 'transaction';
  chain: ChainId;
  reference: string;
}) {
  return options.type === 'wallet'
    ? isValidAddress(options.chain, options.reference)
    : isValidTxHash(options.chain, options.reference);
}

/**
 * Where staff have got to with a piece of off-chain evidence. Reviewing records what it shows and whether its source could be
 * checked; it never says the evidence proves anything. On-chain evidence is read by a notebook and has no review.
 */
export const evidenceReviewStates = ['not_reviewed', 'reviewed', 'unverified'] as const;

export type EvidenceReviewState = (typeof evidenceReviewStates)[number];
