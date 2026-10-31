import { confirmedClaimsToBuild } from '@celia/core';
import type { CaseOperator } from '@/utils/cases/Operators';

export const caseStatuses = ['collecting', 'building', 'sealed'] as const;

/**
 * Where a case stands. A case appears once one claim is confirmed, as `collecting` claims. It moves to `building` evidence by
 * itself once enough claims are confirmed, and the Celia team marks it `sealed`, which means enough evidence. What a lawyer or
 * firm does with a case is theirs: Celia stores the truth and does not track it as a state.
 */
export type CaseStatus = (typeof caseStatuses)[number];

/** The estimated loss in US dollars that, with enough confirmed claims (`confirmedClaimsToBuild`), moves a case to building evidence. */
const estimatedLossToBuild = 1000;

/**
 * Whether a case that is collecting claims has enough to start building evidence: enough confirmed claims and an estimated loss
 * of at least $1,000. The estimate comes from the report, so a case without one is not ready.
 * @param confirmed - How many of its claims are confirmed.
 * @param estimatedLossUsd - The estimated loss in US dollars from the newest report, or null when there is none.
 * @returns True when it is ready to move to building evidence.
 */
export function readyToBuild(confirmed: number, estimatedLossUsd: number | null) {
  return confirmed >= confirmedClaimsToBuild && (estimatedLossUsd ?? 0) >= estimatedLossToBuild;
}

/** What the case bank shows about one case. A summary only: no claimant detail. */
export type CaseRow = {
  id: string;
  number: string;
  name: string;
  claimants: number;
  /** How many of those claimants staff have validated. */
  confirmed: number;
  /** In how many jurisdictions the claimants are. Counted from their claims, so a case is never in just one place. */
  jurisdictions: number;
  /** The people and groups the claimants allege are behind the platform; empty before staff add any. */
  operators: CaseOperator[];
  /** One line on the case, or null before it has a report. */
  description: string | null;
  status: CaseStatus;
  /** Whether an analysis report has been saved for the case. */
  hasReport: boolean;
  /** ISO timestamp of the last change. */
  updatedAt: string;
};

/** The order cases are listed in: enough evidence first, then building evidence, then collecting claims. */
export const caseStatusOrder: Record<CaseStatus, number> = {
  sealed: 0,
  building: 1,
  collecting: 2,
};

/**
 * Sorts cases by their status, and within a status the most recently changed first.
 * @param rows - The cases.
 * @returns A new sorted list.
 */
export function sortByStatus(rows: CaseRow[]) {
  return rows.toSorted(
    (a, b) =>
      caseStatusOrder[a.status] - caseStatusOrder[b.status] ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

/**
 * Formats a case's running number for people, as in `CB-0142`.
 * @param seq - The case's sequence number.
 * @returns The case number.
 */
export function caseNumber(seq: number) {
  return `CB-${String(seq).padStart(4, '0')}`;
}
