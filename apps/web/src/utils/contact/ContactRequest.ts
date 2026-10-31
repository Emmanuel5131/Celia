/** Why an organisation wants to reach the claimants of a case. */
export const contactPurposes = [
  'representation',
  'investigation',
  'support',
  'research',
  'other',
] as const;

export type ContactPurpose = (typeof contactPurposes)[number];

/**
 * Where a request to contact claimants stands. An organisation fills it in as a `draft` and sends it (`submitted`); the assistant
 * reviews it (`agent_reviewed`); staff say yes (`approved`) or no (`rejected`). Only after a yes are claimants asked, and each one
 * answers for themselves.
 */
export const contactStatuses = [
  'draft',
  'submitted',
  'agent_reviewed',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type ContactRequestStatus = (typeof contactStatuses)[number];

/** A claimant's answer to one request. `pending` until they answer; nothing about them is shared before `accepted`. */
export type ContactAnswer = 'pending' | 'accepted' | 'declined';

/** The rules an organisation must agree to, one tick each. The ids are stored with the request. */
export const contactDeclarations = [
  'no_promises',
  'no_funds',
  'no_pressure',
  'no_advertising',
  'data_care',
  'local_rules',
  'public_facts',
] as const;

/** The steps of the form, in order. Each is saved on its own, so an organisation can stop and come back. */
const contactSteps = ['who', 'why', 'rules', 'message', 'review'] as const;

export type ContactStep = (typeof contactSteps)[number];

/** Words an outreach message must not use: promises of an outcome, a recovery or a fee. */
export const promiseWords =
  /\b(guarantee[ds]?|will recover|get (?:all )?your (?:money|funds) back|recover(?:y)? of your|no win,? no fee|risk[- ]free|100%|refund(?:ed)? in full|we will win)\b/iu;

/** Words that turn an outreach message into an advertisement: offers, urgency and discounts. */
export const advertWords =
  /\b(special offer|limited (?:time|offer)|act now|free consultation|discount(?:ed)?|sign up today|call us today|best rates?)\b/iu;

/**
 * The claims a request may ask about: confirmed by staff, not rejected, and whose owner ticked the optional box on the claim form.
 * A claim without that agreement is never asked.
 * @param claim - A claim of the case.
 * @param claim.validatedAt - When staff confirmed it.
 * @param claim.rejectedAt - When staff rejected it.
 * @param claim.contactAgreedAt - When its owner agreed to receive requests.
 * @returns True when the claim may be asked.
 */
export function mayBeAsked(claim: {
  validatedAt: Date | null;
  rejectedAt: Date | null;
  contactAgreedAt: Date | null;
}) {
  return claim.validatedAt !== null && claim.rejectedAt === null && claim.contactAgreedAt !== null;
}
