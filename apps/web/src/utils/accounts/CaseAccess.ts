import type { Account } from '@/utils/accounts/Account';

/**
 * How much of a case someone may read. `full` is Celia staff and verified organisations. Everyone else sees the case with a short
 * preview of each list (`unverified` for an organisation whose application is not approved yet, `person` for a regular account),
 * and the full lists stay behind a prompt. The server cuts the lists before the page is built, so nothing hidden is ever sent.
 */
export type CaseAccess = 'full' | 'unverified' | 'person';

/**
 * Decides how much of a case someone may read.
 * @param options - Who is asking.
 * @param options.account - Their account, or null when they have none.
 * @param options.staff - Whether they pass the staff area's rules.
 * @returns The access.
 */
export function caseAccess(options: { account: Account | null; staff: boolean }): CaseAccess {
  if (options.staff) {
    return 'full';
  }

  if (options.account?.accountType === 'counsel') {
    return options.account.review === 'verified' ? 'full' : 'unverified';
  }

  return 'person';
}
