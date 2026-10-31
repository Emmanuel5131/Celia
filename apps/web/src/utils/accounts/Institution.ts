/** The kinds of professional or institution that can apply. Only a law firm can take a case; the others are reviewed the same way. */
export const institutionKinds = ['law_firm', 'investigative', 'other'] as const;

export type InstitutionKind = (typeof institutionKinds)[number];

/** Where an application stands. A rejected application stays on record with the reason. */
export type ApplicationStatus = 'in_review' | 'approved' | 'rejected';

/** What a lookup found for one check. `off` means the lookup is not set up, `unavailable` that it could not be reached. */
export type LookupResult = {
  status: 'found' | 'none' | 'possible_match' | 'clear' | 'unavailable' | 'off';
  matches: { name: string; detail: string; link: string | null }[];
};

/** The lookups staff ran for an application. They inform the checks; staff still tick each one. */
export type ApplicationLookups = { registry: LookupResult; sanctions: LookupResult };

/** The checks staff tick off against public records before an application can be approved. */
export const reviewChecks = [
  'registry',
  'standing',
  'email_domain',
  'identity',
  'callback',
  'sanctions',
] as const;

export type ReviewCheck = (typeof reviewChecks)[number];

/**
 * The reasons staff pick from when they reject an application. Each has its own wording for the applicant, in the staff locale
 * files (`app_reason_<reason>`), and none names a lookup or a list. The screen and the MCP server use the same ones.
 */
export const rejectReasons = [
  'registry',
  'domain',
  'identity',
  'callback',
  'incomplete',
  'scope',
] as const;

export type RejectReason = (typeof rejectReasons)[number];

/** How many working days we aim to take over a review. It is shown to the applicant when they apply. */
export const reviewDays = 5;

/**
 * Adds working days (Monday to Friday) to a date, as the review period is counted.
 * @param from - The day the application was sent.
 * @param days - How many working days to add.
 * @returns The date that many working days later.
 */
export function addWorkingDays(from: Date, days: number) {
  const date = new Date(from);
  let left = days;

  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();

    if (day !== 0 && day !== 6) {
      left -= 1;
    }
  }

  return date;
}

// Addresses on these domains belong to a mail service, not to an organisation.
const freeMailDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'mail.com',
]);

const hostOf = (website: string) => {
  try {
    return new URL(website.includes('://') ? website : `https://${website}`).hostname
      .toLowerCase()
      .replace(/^www\./u, '');
  } catch {
    return '';
  }
};

/**
 * Whether the applicant's email is on the organisation's own domain: not a free mail service, and the same as the website's
 * domain or one of its subdomains. It is a reason to look closer, not proof either way.
 * @param email - The applicant's verified email.
 * @param website - The website they gave, or nothing.
 * @returns `own` when it matches, `free` for a mail service, `different` when it does not match, `unknown` with no website.
 */
export function emailDomainCheck(
  email: string,
  website: string | null,
): 'own' | 'free' | 'different' | 'unknown' {
  const domain = email.split('@').at(-1)?.toLowerCase() ?? '';

  if (freeMailDomains.has(domain)) {
    return 'free';
  }

  const host = website ? hostOf(website) : '';

  if (!host) {
    return 'unknown';
  }

  return domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`)
    ? 'own'
    : 'different';
}

/**
 * Decides whether a staff member can approve an application now. Every check must be ticked, and a second person approves: the
 * one who marked it ready cannot approve it themselves. In development one person may do both, so the flow can be tried alone.
 * @param input - The state of the application and who is asking.
 * @param input.checks - The checks ticked so far.
 * @param input.readyBy - The staff id that marked it ready for approval, or null.
 * @param input.actor - The staff id asking to approve.
 * @param input.production - Whether this is production.
 * @returns `ok`, or the first reason it cannot be approved.
 */
export function approvalRefusal(input: {
  checks: Partial<Record<ReviewCheck, boolean>>;
  readyBy: string | null;
  actor: string;
  production: boolean;
}): 'ok' | 'checks_incomplete' | 'not_ready' | 'same_person' {
  if (!reviewChecks.every((check) => input.checks[check] === true)) {
    return 'checks_incomplete';
  }

  if (input.readyBy === null) {
    return 'not_ready';
  }

  return input.production && input.readyBy === input.actor ? 'same_person' : 'ok';
}

/** How long a rejected applicant waits before applying again. */
export const reapplyAfterDays = 30;

/**
 * Whether a rejected applicant can apply again yet.
 * @param decidedAt - When it was rejected.
 * @param now - The current time.
 * @returns True once the waiting period has passed.
 */
export function canReapply(decidedAt: Date, now: Date) {
  return now.getTime() - decidedAt.getTime() >= reapplyAfterDays * 24 * 60 * 60 * 1000;
}
