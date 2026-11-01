/** Why a person may not use the staff area, or `allowed`. */
export type StaffDecision = 'allowed' | 'not_staff' | 'email_not_allowed' | 'needs_two_factor';

/**
 * Turns the list of staff emails from the settings into addresses to compare with.
 * @param list - Addresses separated by commas, or nothing.
 * @returns The addresses, trimmed and lower case.
 */
export function parseStaffEmails(list?: string) {
  return (list ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Decides whether a person can use the staff area. Being marked as staff in Clerk is not enough on its own: in production the
 * person's verified email must also be on the Celia domain or our own list, and they must have two-step sign-in on. No list and no domain lets nobody in, so
 * a missing setting can never open the area.
 * @param input - What is known about the person and the settings.
 * @param input.staff - Whether Clerk marks the account as staff.
 * @param input.email - The person's primary email, only when it is verified.
 * @param input.twoFactor - Whether two-step sign-in is on for the account.
 * @param input.allowed - The staff emails from the settings.
 * @param input.domain - The Celia email domain from the settings, or null.
 * @param input.production - Whether this is production.
 * @param input.twoFactorRequired - Whether production demands two-step sign-in; on unless the settings turn it off.
 * @returns `allowed`, or the first reason not.
 */
export function staffAccess(input: {
  staff: boolean;
  email: string | null;
  twoFactor: boolean;
  allowed: string[];
  domain: string | null;
  production: boolean;
  twoFactorRequired: boolean;
}): StaffDecision {
  if (!input.staff) {
    return 'not_staff';
  }

  const email = input.email?.toLowerCase() ?? null;
  const listed =
    email !== null &&
    (input.allowed.includes(email) ||
      (input.domain !== null && email.endsWith(`@${input.domain.toLowerCase()}`)));

  // In development the list and domain are optional; once either is set, or in production, one must name the person.
  if ((input.production || input.allowed.length > 0 || input.domain !== null) && !listed) {
    return 'email_not_allowed';
  }

  return input.production && input.twoFactorRequired && !input.twoFactor
    ? 'needs_two_factor'
    : 'allowed';
}
