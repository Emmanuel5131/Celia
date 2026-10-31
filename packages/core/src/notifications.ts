/**
 * Every notification Celia can send. A type is one thing that happened to one person; the catalog below says who it is for, which
 * preference controls it and whether it also goes by email. Copy and templates live in the web app, keyed by these types.
 */
export const notificationTypes = [
  'claim_submitted',
  'ownership_confirmed',
  'claim_validated',
  'claim_in_review',
  'claim_rejected',
  'claim_in_case',
  'case_sealed',
  'case_taken',
  'counsel_received',
  'counsel_verified',
  'counsel_review_reset',
  'application_rejected',
  'case_ready_for_counsel',
  'case_taken_by_you',
  'contact_request',
  'contact_request_decided',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

/** `account` is about the person's own account and cannot be turned off. `claims` and `cases` follow the person's preferences. */
export const notificationCategories = ['account', 'claims', 'cases'] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

/** The categories a person may turn off. */
export const optionalCategories = ['claims', 'cases'] as const;

export type OptionalCategory = (typeof optionalCategories)[number];

type CatalogEntry = {
  /** Who receives it: a person with a claim, or a lawyer. */
  audience: 'claimant' | 'counsel';
  category: NotificationCategory;
  /** Sent whatever the person's preferences say. Only account and review notices are. */
  essential: boolean;
  /** Also sent by email. Every type appears in the person's notifications inside the app. */
  email: boolean;
};

export const notificationCatalog: Record<NotificationType, CatalogEntry> = {
  claim_submitted: { audience: 'claimant', category: 'claims', essential: false, email: true },
  ownership_confirmed: { audience: 'claimant', category: 'claims', essential: false, email: true },
  claim_validated: { audience: 'claimant', category: 'claims', essential: false, email: true },
  // Staff starting on a claim is shown in the app only: an email for it would be noise.
  claim_in_review: { audience: 'claimant', category: 'claims', essential: false, email: false },
  claim_rejected: { audience: 'claimant', category: 'claims', essential: false, email: true },
  claim_in_case: { audience: 'claimant', category: 'cases', essential: false, email: true },
  case_sealed: { audience: 'claimant', category: 'cases', essential: false, email: true },
  case_taken: { audience: 'claimant', category: 'cases', essential: false, email: true },
  counsel_received: { audience: 'counsel', category: 'account', essential: true, email: true },
  counsel_verified: { audience: 'counsel', category: 'account', essential: true, email: true },
  counsel_review_reset: { audience: 'counsel', category: 'account', essential: true, email: true },
  application_rejected: { audience: 'counsel', category: 'account', essential: true, email: true },
  case_ready_for_counsel: { audience: 'counsel', category: 'cases', essential: false, email: true },
  case_taken_by_you: { audience: 'counsel', category: 'cases', essential: true, email: true },
  // An organisation asking to contact a claimant: the claimant must be told, so it always goes by email.
  contact_request: { audience: 'claimant', category: 'claims', essential: true, email: true },
  contact_request_decided: { audience: 'counsel', category: 'account', essential: true, email: true },
};

/** A person's email choices by category. A category with no entry is on. */
export type EmailPreferences = Partial<Record<OptionalCategory, boolean>>;

/**
 * Decides whether a notification also goes by email. Essential notices always do; the rest follow the person's choice for their
 * category, which is on unless they turned it off.
 * @param type - The notification type.
 * @param preferences - The person's email choices.
 * @returns True when an email should be sent.
 */
export function shouldEmail(type: NotificationType, preferences: EmailPreferences) {
  const entry = notificationCatalog[type];

  if (!entry.email) {
    return false;
  }

  if (entry.essential || entry.category === 'account') {
    return true;
  }

  return preferences[entry.category] !== false;
}
