import { isValidAddress } from './chains/address';
import type { ChainId } from './chains/chains';
import type { FraudType } from './claim';
import { fraudTypes } from './claim';

/** How many confirmed claims move a case from collecting claims to building evidence, and so allow its first analysis. */
export const confirmedClaimsToBuild = 5;

/**
 * What a platform said that the chain can show or not show. Each kind is answered by the tests that back it; `other` is a
 * statement the chain cannot show, so it is kept and marked not checkable, never guessed.
 */
export const statementKinds = ['withdrawals', 'returns', 'reserves', 'history', 'other'] as const;

export type StatementKind = (typeof statementKinds)[number];

/** A public statement the platform made, with where it was said. Staff enter it; a claimant's own words never stand in for it. */
export type PlatformStatement = {
  kind: StatementKind;
  text: string;
  sourceUrl: string;
  /** The day it was said, as `2026-09-14`, when known. */
  saidOn?: string;
};

type AnalysisTemplate = {
  version: string;
  fraudTypes: readonly FraudType[];
  /** The longest window one run reads. A longer case is clamped to the most recent days, and the brief says so. */
  maxWindowDays: number;
  /** How long after the last known victim payment the window runs: long enough to see payouts stop, short enough not to read a finished scheme for years. */
  windowAfterLastPaymentDays: number;
  budget: { maxRuns: number; maxPagesPerAddress: number; timeoutSeconds: number };
  tests: readonly { id: string; title: string; backs: readonly StatementKind[] }[];
};

/**
 * The fixed test templates. A template is a notebook Celia owns and signs off with counsel; this is what the app needs to know
 * about it (docs/integrators/sandworm-analysis-contract.md). The caps are a first proposal, in one place so they are easy to change.
 */
export const analysisTemplates = {
  'investment-platform': {
    version: '1.0.0',
    fraudTypes: ['investment_platform'],
    maxWindowDays: 730,
    windowAfterLastPaymentDays: 30,
    budget: { maxRuns: 3, maxPagesPerAddress: 50, timeoutSeconds: 300 },
    tests: [
      { id: 'inflow-outflow', title: 'Money in and out', backs: ['reserves', 'history'] },
      { id: 'withdrawals-by-day', title: 'Withdrawals by day', backs: ['withdrawals'] },
      { id: 'concentration', title: 'Who the money depends on', backs: ['reserves'] },
      { id: 'payout-source', title: 'Where payouts came from', backs: ['returns'] },
    ],
  },
} as const satisfies Record<string, AnalysisTemplate>;

export type AnalysisTemplateId = keyof typeof analysisTemplates;

/**
 * The chains a template can read addresses on today: Ethereum, Base, Arbitrum and Optimism through Blockscout and Etherscan, and
 * Avalanche through Routescan. Tron and Solana are not here: Sandworm reaches them only through Nansen, which gives labelled flows
 * and counterparties but no raw transfers. A claim on another chain is still accepted; it is "statement only, not analysed".
 */
export const analysableChains = [
  'ethereum',
  'base',
  'arbitrum',
  'optimism',
  'avalanche',
] as const satisfies readonly ChainId[];

/** A wallet, contract or other address on one chain. */
export type ChainAddress = { chain: ChainId; address: string };

/** What the brief builder needs from a case. Nothing about a claimant is in it: only the platform's side. */
export type BriefInput = {
  caseId: string;
  caseNumber: string;
  caseName: string;
  status: 'collecting' | 'building' | 'sealed';
  confirmedClaims: number;
  /** The fraud type of each confirmed claim. */
  fraudTypes: readonly FraudType[];
  /** Where the money went, as the claims name it. */
  receiving: readonly ChainAddress[];
  tokenContracts: readonly ChainAddress[];
  hosts: readonly string[];
  /** When the earliest confirmed payment was made, as an ISO time, or null when no check found one: the dates then start as far back as the template reads. */
  firstPaymentAt: string | null;
  /** When the latest payment was made, as an ISO time or day, or null when none is known. The dates then run to today. */
  lastPaymentAt: string | null;
  statements: readonly PlatformStatement[];
  /** How many briefs were already approved for the case. */
  runs: number;
  now: Date;
};

export type PreflightCode =
  | 'sealed'
  | 'not_enough_claims'
  | 'no_template'
  | 'no_analysable_chain'
  | 'no_identifier'
  | 'no_statement'
  | 'run_cap'
  | 'statement_not_checkable'
  | 'chains_skipped'
  | 'addresses_skipped'
  | 'window_clamped'
  | 'window_estimated';

/** A reason the analysis cannot start, or something staff should know before approving it. */
export type PreflightProblem = { code: PreflightCode; blocking: boolean };

/** What Celia asks Sandworm to do for a case: structured, built from the case, and stored with the run. */
export type Brief = {
  case: { id: string; number: string; name: string };
  template: { id: AnalysisTemplateId; version: string };
  chains: ChainId[];
  receivingAddresses: ChainAddress[];
  tokenContracts: ChainAddress[];
  hosts: string[];
  /** Whole days, as `2026-09-14`. Never "all time". */
  window: { from: string; to: string };
  platformStatements: PlatformStatement[];
  /** Which statements (by position in `platformStatements`) each test backs. A statement no test backs is not checkable. */
  tests: { id: string; statements: number[] }[];
  budget: { maxRuns: number; maxPagesPerAddress: number; timeoutSeconds: number };
  /** Chains the claims name that notebooks cannot read, so they are statement only. */
  skippedChains: ChainId[];
};

/**
 * Picks the fraud type a case is about: the most common among its confirmed claims, and where two are equally common the one
 * lost most often (the order of `fraudTypes`).
 * @param types - The fraud type of each confirmed claim.
 * @returns The type, or undefined when there are no claims.
 */
export function dominantFraudType(types: readonly FraudType[]) {
  const counts = new Map<FraudType, number>();

  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return [...counts.entries()].toSorted(
    ([a, countA], [b, countB]) => countB - countA || fraudTypes.indexOf(a) - fraudTypes.indexOf(b),
  )[0]?.[0];
}

/**
 * Finds the template for a fraud type.
 * @param fraudType - The case's fraud type.
 * @returns The template id, or undefined when none covers it.
 */
export function templateFor(fraudType: FraudType | undefined) {
  const ids = Object.keys(analysisTemplates) as AnalysisTemplateId[];

  return fraudType
    ? ids.find((id) => analysisTemplates[id].fraudTypes.some((t) => t === fraudType))
    : undefined;
}

const isAnalysable = (chain: ChainId) => analysableChains.some((id) => id === chain);

// EVM addresses are the same address whatever the capitals, so they are compared in lower case. The other families are case-sensitive.
const sameAddress = (a: ChainAddress, b: ChainAddress) =>
  a.chain === b.chain &&
  (a.address === b.address || a.address.toLowerCase() === b.address.toLowerCase());

// Keeps the addresses on a chain notebooks can read, once each. Those on other chains are not counted as mistakes; an address with
// the wrong shape on a readable chain is, so staff are told.
function usable(addresses: readonly ChainAddress[]) {
  const kept: ChainAddress[] = [];
  let invalid = 0;

  for (const item of addresses) {
    const candidate = { chain: item.chain, address: item.address.trim() };

    if (!isAnalysable(candidate.chain)) {
      continue;
    }

    if (!isValidAddress(candidate.chain, candidate.address)) {
      invalid += 1;
    } else if (!kept.some((existing) => sameAddress(existing, candidate))) {
      kept.push(candidate);
    }
  }

  return { kept, invalid };
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Checks whether a case is ready for a first analysis and, when it is, builds the brief. The checks run in Celia, before
 * anything reaches Sandworm, so a vague or empty request never spends compute. Blocking problems stop the analysis; the others
 * are for staff to read before they approve.
 * @param input - The case, as the platform's side only.
 * @returns The problems, and the brief when none blocks.
 */
export function prepareAnalysis(input: BriefInput) {
  const problems: PreflightProblem[] = [];
  const block = (code: PreflightCode) => problems.push({ code, blocking: true });
  const warn = (code: PreflightCode) => problems.push({ code, blocking: false });

  const templateId = templateFor(dominantFraudType(input.fraudTypes));
  const template = templateId ? analysisTemplates[templateId] : undefined;

  if (input.status === 'sealed') {
    block('sealed');
  }

  if (input.confirmedClaims < confirmedClaimsToBuild) {
    block('not_enough_claims');
  }

  if (!template) {
    block('no_template');
  }

  if (template && input.runs >= template.budget.maxRuns) {
    block('run_cap');
  }

  const receiving = usable(input.receiving);
  const contracts = usable(input.tokenContracts);
  const chains = analysableChains.filter((chain) =>
    [...receiving.kept, ...contracts.kept].some((item) => item.chain === chain),
  );
  const skippedChains = [
    ...new Set(
      [...input.receiving, ...input.tokenContracts]
        .map((item) => item.chain)
        .filter((chain) => !isAnalysable(chain)),
    ),
  ];

  if (receiving.kept.length === 0 && contracts.kept.length === 0) {
    block(skippedChains.length > 0 ? 'no_analysable_chain' : 'no_identifier');
  }

  if (skippedChains.length > 0) {
    warn('chains_skipped');
  }

  if (receiving.invalid + contracts.invalid > 0) {
    warn('addresses_skipped');
  }

  if (input.statements.length === 0) {
    block('no_statement');
  }

  const readable = (value: string | null) => {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
  };
  const first = readable(input.firstPaymentAt);
  const last = readable(input.lastPaymentAt);

  const tests = (template?.tests ?? []).map((test) => ({
    id: test.id,
    statements: input.statements.flatMap((statement, index) =>
      test.backs.some((kind) => kind === statement.kind) ? [index] : [],
    ),
  }));

  const backed = new Set(tests.flatMap((test) => test.statements));

  if (input.statements.some((_, index) => !backed.has(index))) {
    warn('statement_not_checkable');
  }

  if (problems.some((problem) => problem.blocking) || !template || !templateId) {
    return { problems, brief: null };
  }

  // The window ends a while after the last known payment, not at today, so a finished scheme is not read for years. It never ends
  // in the future or before the first payment. Without a payment date it runs to today.
  const afterLast = last
    ? new Date(last.getTime() + template.windowAfterLastPaymentDays * 86_400_000)
    : null;
  const to =
    afterLast && (!first || afterLast >= first)
      ? new Date(Math.min(afterLast.getTime(), input.now.getTime()))
      : input.now;

  // The window starts at the first payment and is never longer than the template reads: a longer one keeps its later part, where the
  // scheme ended. With no first payment (staff cannot fix that, so it does not block) the dates start as far back as the template
  // reads, staff see them before they approve, and the probe will narrow them to the first activity.
  const earliest = new Date(to.getTime() - template.maxWindowDays * 86_400_000);
  const clamped = first !== null && first < earliest;
  const from = first && !clamped ? first : earliest;

  if (!first) {
    warn('window_estimated');
  } else if (clamped) {
    warn('window_clamped');
  }

  const brief: Brief = {
    case: { id: input.caseId, number: input.caseNumber, name: input.caseName },
    template: { id: templateId, version: template.version },
    chains,
    receivingAddresses: receiving.kept,
    tokenContracts: contracts.kept,
    hosts: [...new Set(input.hosts.map((host) => host.trim().toLowerCase()).filter(Boolean))],
    window: { from: day(from), to: day(to) },
    platformStatements: input.statements.map((statement) => ({ ...statement })),
    tests,
    budget: template.budget,
    skippedChains,
  };

  return { problems, brief };
}
