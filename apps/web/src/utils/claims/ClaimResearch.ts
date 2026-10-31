import { createHash } from 'node:crypto';

/**
 * The only name research may use for a claimant: `claimant_` and eight hex digits taken from a hash of the claim id. The same
 * claim always gets the same label, so a label written into evidence or a report can be read back to its claim by staff, and
 * nobody else can work out the claim from it. It is never a name, a wallet or an account.
 * @param claimId - The claim id.
 * @returns The label, such as `claimant_3fa9c21b`.
 */
export function claimantLabel(claimId: string) {
  return `claimant_${createHash('sha256').update(claimId).digest('hex').slice(0, 8)}`;
}

/** A piece of off-chain evidence proposed for a case. It is a draft: nothing is saved until a staff member confirms it. */
export type EvidenceDraft = {
  type: 'link';
  title: string;
  note: string;
  sourceUrl: string;
  /** The day it was looked up, as 2026-10-31. */
  capturedOn: string;
};

const day = (time: string) => time.slice(0, 10);

/**
 * Drafts the evidence for when a domain was registered. It states the date and nothing about why.
 * @param domain - The domain.
 * @param registration - What the registry says.
 * @param registration.registeredOn - When the domain was registered, as an ISO time.
 * @param registration.daysOld - How many days ago that was.
 * @param now - The time of the lookup.
 * @returns The draft, or null when the registry gave no registration date.
 */
export function registrationDraft(
  domain: string,
  registration: { registeredOn: string | null; daysOld: number | null },
  now: Date,
): EvidenceDraft | null {
  if (!registration.registeredOn) {
    return null;
  }

  const age =
    registration.daysOld === null ? '' : `, ${registration.daysOld} days before this check`;

  return {
    type: 'link',
    title: `${domain}: domain registration`,
    note: `The public domain registry shows ${domain} was registered on ${day(registration.registeredOn)}${age}.`,
    sourceUrl: `https://lookup.icann.org/en/lookup?name=${domain}`,
    capturedOn: day(now.toISOString()),
  };
}

/**
 * The date in an Internet Archive capture stamp.
 * @param stamp - The stamp, such as `20190402101500`.
 * @returns The day, such as `2019-04-02`.
 */
export function archiveDate(stamp: string) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

/**
 * Drafts the evidence for the first time the Internet Archive saved a site. The link opens the saved copy itself.
 * @param domain - The domain.
 * @param stamp - The capture stamp of the first copy.
 * @param now - The time of the lookup.
 * @returns The draft.
 */
export function archiveDraft(domain: string, stamp: string, now: Date): EvidenceDraft {
  return {
    type: 'link',
    title: `${domain}: first saved copy`,
    note: `The Internet Archive first saved ${domain} on ${archiveDate(stamp)}. This is the earliest public copy it holds.`,
    sourceUrl: `https://web.archive.org/web/${stamp}/${domain}`,
    capturedOn: day(now.toISOString()),
  };
}

/**
 * Cleans a platform host a claimant typed so it can be asked of a public registry. Only a plain domain name passes: an address, a
 * port, a path or a name with no dot is refused, so nothing private is ever looked up.
 * @param host - The host as typed, such as `https://Example.com/path`.
 * @returns The lower-case domain, or null when it is not a public domain name.
 */
export function publicDomain(host: string) {
  const name = host
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//u, '')
    .replace(/[/?#].*$/u, '')
    .replace(/^www\./u, '');

  const isDomain = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,24}$/u.test(name);

  return isDomain && name !== 'localhost' ? name : null;
}

/**
 * The names to ask a registry about, most specific first: the domain itself, then each parent down to two labels. A registry only
 * knows the registered domain, so `app.example.com` is answered by `example.com`.
 * @param domain - A public domain name.
 * @returns The names, at most three.
 */
export function registryNames(domain: string) {
  const labels = domain.split('.');

  return Array.from({ length: Math.min(labels.length - 1, 3) }, (_, i) =>
    labels.slice(i).join('.'),
  );
}

/**
 * How many whole days lie between two times.
 * @param from - The earlier time, as an ISO string.
 * @param to - The later time.
 * @returns The days, or null when `from` is not a time.
 */
export function daysBetween(from: string, to: Date) {
  const start = new Date(from).getTime();

  return Number.isNaN(start) ? null : Math.floor((to.getTime() - start) / 86_400_000);
}
