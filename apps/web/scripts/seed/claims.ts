import { randomUUID } from 'node:crypto';
import type { ChainId } from '@celia/core';
import type { claimFollowUpSchema, claimSchema } from '@/models/Schema';
import type { FollowUpChannel } from '@/utils/claims/FollowUp';
import { activeAddress, emptyAddress } from './addresses';
import { base58Chars, hex, int, logNormal, pick, random, weighted } from './random';
import type { Scenario } from './scenarios';

export const DAY = 86_400_000;

/** The claims that come with proof files. Every claim has an id before it is inserted, so this says which ones are these. */
export const strongClaimIds = new Set<string>();

/** A video that opens, for the claims that come with everything. The other video links are made up and do not. */
const sampleVideo = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

export const money = (value: number) => `$${value.toLocaleString('en-US')}`;

/** Where victims live, by how often they appear in the reports the seed is modelled on. Lowercase ISO codes. */
export const victimCountries: [string, number][] = [
  ['us', 34],
  ['gb', 7],
  ['in', 5],
  ['ng', 5],
  ['ca', 4],
  ['au', 4],
  ['ph', 3],
  ['id', 3],
  ['br', 3],
  ['de', 3],
  ['sg', 2],
  ['ae', 2],
  ['mx', 2],
  ['za', 2],
  ['ke', 2],
  ['fr', 2],
  ['tr', 2],
  ['my', 2],
  ['th', 1.5],
  ['es', 1.5],
  ['it', 1.5],
  ['nl', 1.5],
  ['gh', 1],
  ['co', 1],
  ['ug', 0.8],
  ['tz', 0.8],
];

/** The states where US cases are most often filed. */
export const usStates = ['us-ny', 'us-ca', 'us-tx', 'us-fl', 'us-nj', 'us-il', 'us-wa', 'us-pa'];

const syllables = [
  've',
  'kor',
  'tan',
  'vex',
  'mir',
  'lum',
  'zen',
  'ora',
  'nex',
  'qui',
  'bra',
  'dyn',
  'sol',
  'arx',
  'tri',
  'pho',
  'lyr',
  'mon',
  'cal',
  'fen',
  'har',
  'jov',
  'kel',
  'nor',
  'pel',
  'rav',
  'sil',
  'tov',
  'urb',
  'wyn',
];

/** An invented word, long enough that it is unlikely to be a real brand. */
export function inventedWord() {
  const word = Array.from({ length: int(2, 3) }, () => pick(syllables)).join('');

  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** What every claim in one case shares: the operator, where the money went, and the token if there is one. */
export type CaseFacts = {
  name: string;
  key: string;
  /** The operator's site, when it had one. Clusters of attacker wallets have none. */
  host: string | null;
  country: string;
  now: number;
  handle: string | null;
  token: string | null;
  deposit: Map<ChainId, string>;
  contract: Map<ChainId, string>;
};

const chainFamily = (chain: ChainId) => {
  if (chain === 'tron' || chain === 'solana' || chain === 'bitcoin') {
    return chain;
  }

  return 'evm';
};

/** An address that looks like one on the chain. Nothing here belongs to anyone. */
function txHash(chain: ChainId) {
  const family = chainFamily(chain);

  if (family === 'solana') {
    return base58Chars(88);
  }

  return family === 'evm' ? `0x${hex(64)}` : hex(64);
}

function assetFor(chain: ChainId, scenario: Scenario) {
  const family = chainFamily(chain);

  if (family === 'bitcoin') {
    return 'BTC';
  }

  if (family === 'tron') {
    return 'USDT';
  }

  if (family === 'solana') {
    return scenario.assets.includes('SOL') ? pick(['SOL', 'USDC']) : 'USDC';
  }

  if (chain === 'bsc') {
    return pick(['BNB', 'USDT']);
  }

  return pick([
    ...scenario.assets.filter((asset) => ['ETH', 'USDC', 'USDT'].includes(asset)),
    'USDT',
  ]);
}

const day = (at: number) => new Date(at).toISOString().slice(0, 10);

/** What people say they lost: sometimes exact, sometimes rounded, sometimes in the asset they sent. */
function amountText(value: number, asset: string) {
  const style = random();
  const thousands =
    value >= 10_000 ? `$${Math.round(value / 1000)}k` : money(Math.round(value / 100) * 100);

  if (style < 0.45) {
    return money(value);
  }

  if (style < 0.65) {
    return `about ${thousands}`;
  }

  if (style < 0.8 && ['USDT', 'USDC'].includes(asset)) {
    return `${value.toLocaleString('en-US')} ${asset}`;
  }

  return money(Math.round(value / 500) * 500 || value);
}

const closers = [
  'I have screenshots of the chat and the transactions.',
  'I reported it to the police and my bank.',
  'I reported it to the exchange, but they said they cannot reverse it.',
  'The website is offline now.',
  'The website still shows my balance, but I cannot withdraw.',
  'I am not the only one. Others in the group lost money too.',
  'This was my savings and I am asking for help.',
  'I can provide the full chat export.',
];

/** The person's account, in their words: one of the scenario's, sometimes cut short, with details that vary from person to person. */
function statementFor(scenario: Scenario, facts: CaseFacts) {
  const base = pick(scenario.statements);
  const sentences = random() < 0.2 ? [base.split('. ')[0] ?? base] : [base];
  const extras = weighted<number>([
    [0, 4],
    [1, 4],
    [2, 2],
  ]);

  for (const closer of [...closers].toSorted(() => random() - 0.5).slice(0, extras)) {
    sentences.push(closer);
  }

  if (facts.handle && random() < 0.35) {
    sentences.push(`They used the handle ${facts.handle}.`);
  }

  if (random() < 0.25) {
    sentences.push(`I sent it in ${int(2, 9)} payments.`);
  }

  return sentences
    .map((sentence) => (sentence.endsWith('.') ? sentence : `${sentence}.`))
    .join(' ');
}

/**
 * One claim, in the shape of the case's scenario. Like real claims, some leave out what the person did not have: not everyone knows
 * the deposit address or the handle, and not everyone can sign for their wallet.
 * @param scenario - The kind of case.
 * @param facts - What the case's claims share.
 * @param claim - The claimant and when the claim arrived.
 * @param claim.userId - Who filed it.
 * @param claim.submittedAt - When they sent it.
 * @param claim.country - Where they live.
 * @returns The row to insert.
 */
export function buildClaim(
  scenario: Scenario,
  facts: CaseFacts,
  claim: { userId: string; submittedAt: number; country: string },
) {
  const method = weighted(scenario.payment);
  const chain = weighted(scenario.chains);
  const own = method === 'wallet';
  const at = claim.submittedAt;
  const lastPaid = at - int(1, 30) * DAY;
  const asset = assetFor(chain, scenario);
  const app = own && scenario.wallets && random() < 0.85 ? pick(scenario.wallets) : null;
  const deposit = facts.deposit.get(chain) ?? emptyAddress(chain);
  const contract = facts.contract.get(chain) ?? emptyAddress(chain).toLowerCase();
  // A few claims come with everything: a signed wallet, files, a video and a large loss. A person has to look at these.
  const strong = own && random() < 0.04;
  const id = randomUUID();

  if (strong) {
    strongClaimIds.add(id);
  }

  const loss = Math.min(
    5_000_000,
    Math.max(
      strong ? 100_000 : 20,
      Math.round(logNormal(scenario.medianLoss, scenario.spread) / 10) * 10,
    ),
  );
  const signed = strong || (own && random() < 0.55);
  const asked = strong || (own && !signed && random() < 0.2);
  const checked = asked && !strong && random() < 0.4;
  const age = facts.now - at;
  const validated = age > 7 * DAY && random() < 0.6;
  const rejected = !validated && age > 7 * DAY && random() < 0.15;
  const started = !validated && !rejected && age > 2 * DAY && random() < 0.3;

  facts.deposit.set(chain, deposit);
  facts.contract.set(chain, contract);

  return {
    id,
    userId: claim.userId,
    fraudType: scenario.fraudType,
    fraudTypes: [scenario.fraudType, ...(random() < 0.6 ? (scenario.alsoFits ?? []) : [])],
    paymentMethod: method,
    chain,
    walletAddress: own ? (strong ? activeAddress(chain) : emptyAddress(chain)) : null,
    txHash: own && random() < 0.15 ? null : txHash(chain),
    platformName: facts.name,
    platformKey: facts.key,
    platformUrl: facts.host ? `https://${facts.host}` : null,
    platformHost: facts.host,
    operatorHandle: facts.handle && random() < 0.75 ? facts.handle : null,
    tokenContract: scenario.token && random() < 0.8 ? contract : null,
    tokenName: facts.token,
    fraudDescription: scenario.description ?? null,
    walletType: app?.type ?? null,
    walletApp: app?.app ?? null,
    accountKind: own && chainFamily(chain) === 'evm' ? ('eoa' as const) : null,
    destinationAddress: strong ? activeAddress(chain) : random() < 0.55 ? deposit : null,
    firstPaymentOn: day(lastPaid - int(0, 60) * DAY),
    lastPaymentOn: day(lastPaid),
    assetSent: asset,
    contactChannel: random() < 0.9 ? pick(scenario.channels) : null,
    amountLost: amountText(loss, asset),
    statement: statementFor(scenario, facts),
    country: claim.country,
    ownership: signed || checked ? 'signed' : asked ? 'review' : 'unsigned',
    ownershipMethod: signed ? ('signature' as const) : checked ? ('staff' as const) : null,
    reviewVideoUrl:
      asked && (strong || random() < 0.5)
        ? strong
          ? sampleVideo
          : `https://www.loom.com/share/${hex(32)}`
        : null,
    proofNote: strong
      ? 'Signed with my wallet. Screenshots of the app and the first transfer, and a video of the withdrawal failing.'
      : asked
        ? 'Screenshots of my wallet app and the first transfer.'
        : null,
    reviewRequestedAt: asked ? new Date(at + int(0, 2) * DAY) : null,
    reviewedAt: checked && !strong ? new Date(Math.min(facts.now, at + int(2, 9) * DAY)) : null,
    nonce: hex(32),
    signature: signed ? `0x${hex(130)}` : null,
    signedAt: signed ? new Date(at) : null,
    status: 'submitted',
    consentedAt: new Date(at),
    // Most people tick the optional box that lets verified organisations ask to contact them; about a third do.
    contactAgreedAt: random() < 0.35 ? new Date(at) : null,
    validatedAt: validated ? new Date(at + int(1, 6) * DAY) : null,
    // A few unconfirmed claims have been started on by staff, and a few were rejected, so every state exists to look at.
    staffReviewStartedAt: validated || rejected || started ? new Date(at + int(1, 3) * DAY) : null,
    rejectedAt: rejected ? new Date(at + int(2, 8) * DAY) : null,
    rejectionNote: rejected ? 'We could not match this claim to the payment you described.' : null,
    submittedAt: new Date(at),
    createdAt: new Date(at),
    updatedAt: new Date(at),
  } satisfies typeof claimSchema.$inferInsert;
}

const bestTimes = [
  'Evenings, English',
  'Weekdays after 17:00, English',
  'Mornings, French',
  'Weekends, English',
  'Any time, French',
  'Lunchtime on weekdays, English',
];

/**
 * How a claimant asked to be followed up, as the claim form saves it. Email uses the address on the person's account, so a real
 * account has none here. A sample claimant has no account, so their sample address is kept here for staff to see. The numbers
 * are in the range reserved for fiction and the addresses are on `example.com`, so none can reach a real person.
 * @param claim - The claim and who filed it.
 * @param claim.id - The claim id.
 * @param claim.userId - The claimant.
 * @param hasAccount - Whether the claimant is a real account.
 * @returns The row to insert.
 */
export function buildFollowUp(claim: { id: string; userId: string }, hasAccount: boolean) {
  const channel = weighted<FollowUpChannel>([
    ['email', 55],
    ['phone', 25],
    ['messaging', 20],
  ]);
  const number = claim.userId.replaceAll(/\D/gu, '').slice(-5) || hex(5);
  const values = {
    email: hasAccount ? null : `claimant.${number}@example.com`,
    phone: `+44 7700 900${int(100, 999)}`,
    messaging: `@user_${hex(6)}`,
  };

  return {
    claimId: claim.id,
    channel,
    value: values[channel],
    bestTime: random() < 0.8 ? pick(bestTimes) : null,
  } satisfies typeof claimFollowUpSchema.$inferInsert;
}
