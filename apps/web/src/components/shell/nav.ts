import type { AccountType } from '@/utils/accounts/Account';

export type NavId =
  | 'overview'
  | 'claims'
  | 'cases'
  | 'jurisdictions'
  | 'settings'
  | 'staffOverview'
  | 'staffApplications'
  | 'staffClaims'
  | 'staffContact'
  | 'staffCases'
  | 'staffMail'
  | 'staffSandworm'
  | 'staffActivity';

export const navHref: Record<NavId, string> = {
  overview: '/dashboard',
  claims: '/dashboard/claims',
  cases: '/dashboard/cases',
  jurisdictions: '/dashboard/jurisdictions',
  settings: '/dashboard/settings',
  staffOverview: '/dashboard/staff',
  staffApplications: '/dashboard/staff/applications',
  staffClaims: '/dashboard/staff/claims',
  staffContact: '/dashboard/staff/contact-requests',
  staffCases: '/dashboard/staff/cases',
  staffMail: '/dashboard/staff/mail',
  staffSandworm: '/dashboard/staff/sandworm',
  staffActivity: '/dashboard/staff/activity',
};

/**
 * The left navigation for each account type. The case bank is public, so both see it; what they see inside differs.
 * Only people file claims, so only they get "claims". Counsel will gain "my cases" and "firm" here.
 */
export const navByAccount: Record<AccountType, NavId[]> = {
  person: ['overview', 'claims', 'cases', 'jurisdictions', 'settings'],
  counsel: ['overview', 'cases', 'jurisdictions', 'settings'],
};

/**
 * The left navigation for Celia staff. A staff account is not a regular account: it sees only the staff queues, never the
 * claims, case bank or settings pages the people it serves use.
 */
export const staffNav: NavId[] = [
  'staffOverview',
  'staffApplications',
  'staffClaims',
  'staffContact',
  'staffCases',
  'staffMail',
  'staffSandworm',
  'staffActivity',
];

/** The areas whose item is current only on its own page, because other items live beneath its address. */
export const exactNav: NavId[] = ['overview', 'staffOverview'];
