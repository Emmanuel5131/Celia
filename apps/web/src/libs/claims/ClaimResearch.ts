import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import * as z from 'zod';
import { getCase } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { claimSchema } from '@/models/Schema';
import {
  archiveDraft,
  daysBetween,
  publicDomain,
  registrationDraft,
  registryNames,
} from '@/utils/claims/ClaimResearch';
import type { EvidenceDraft } from '@/utils/claims/ClaimResearch';

/** The most hosts looked up for one case, so a request stays within what the public services allow. */
const lookupLimit = 10;

const rdapValidation = z.object({
  events: z.array(z.object({ eventAction: z.string(), eventDate: z.string() })).default([]),
});

const cdxValidation = z.array(z.array(z.string()));

/**
 * Reads JSON from a public service. A redirect is followed by hand, and only to https on a public domain name with no port or
 * sign-in, so a service can never send this server to an address inside our network.
 * @param url - The address.
 * @param hops - How many redirects may still be followed.
 * @returns The JSON, or null when the service did not answer well or sent us somewhere not allowed.
 */
async function getJson(url: string, hops = 3): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(6000),
  });
  const location = response.headers.get('location');

  if (response.status >= 300 && response.status < 400 && location) {
    const next = new URL(location, url);
    const allowed =
      hops > 0 &&
      next.protocol === 'https:' &&
      next.port === '' &&
      next.username === '' &&
      publicDomain(next.hostname) !== null;

    return allowed ? await getJson(next.href, hops - 1) : null;
  }

  return response.ok ? await response.json() : null;
}

/**
 * Asks a public registry when a domain was registered. The most specific name a registry knows is the answer, so a subdomain
 * is answered by its registered domain.
 * @param domain - A public domain name.
 * @returns The registration time and its age in days, or null when no registry answered.
 */
async function lookUpRegistration(domain: string) {
  const answers = await Promise.all(
    registryNames(domain).map(async (name) =>
      rdapValidation.safeParse(await getJson(`https://rdap.org/domain/${name}`).catch(() => null)),
    ),
  );
  const known = answers.find((answer) => answer.success && answer.data.events.length > 0);
  const registeredOn = known?.success
    ? (known.data.events.find((event) => event.eventAction === 'registration')?.eventDate ?? null)
    : null;

  return registeredOn ? { registeredOn, daysOld: daysBetween(registeredOn, new Date()) } : null;
}

/**
 * Asks the Internet Archive for the first time it saved the site, which dates the site from outside the platform.
 * @param domain - A public domain name.
 * @returns The capture stamp of the first copy, or null when it never saved the site or did not answer.
 */
async function lookUpFirstCapture(domain: string) {
  const rows = cdxValidation.safeParse(
    await getJson(
      `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&limit=1&fl=timestamp`,
    ).catch(() => null),
  );

  return rows.success ? (rows.data[1]?.[0] ?? null) : null;
}

async function researchHost(host: string) {
  const domain = publicDomain(host);

  if (!domain) {
    return { host, drafts: [], problem: 'not a public domain name' };
  }

  const [registration, stamp] = await Promise.all([
    lookUpRegistration(domain),
    lookUpFirstCapture(domain),
  ]);
  const now = new Date();
  const drafts: EvidenceDraft[] = [
    ...(registration ? [registrationDraft(domain, registration, now)] : []),
    ...(stamp ? [archiveDraft(domain, stamp, now)] : []),
  ].filter((draft) => draft !== null);

  return {
    host,
    drafts,
    ...(drafts.length === 0 && { problem: 'no registry or archive record found' }),
  };
}

/**
 * Researches the platform of a case off the chain, from the hosts its confirmed claims name, and proposes what it finds as
 * evidence drafts. A draft is not evidence: nothing is saved here, and it becomes evidence only when it is confirmed and added
 * through the evidence tool. No claimant's wallet, name or statement is read.
 * @param caseId - The case id.
 * @returns The drafts and the hosts that gave none, or null when there is no such case.
 */
export async function researchCaseClaims(caseId: string) {
  const detail = await getCase(caseId);

  if (!detail) {
    return null;
  }

  const claims = await db
    .select({ host: claimSchema.platformHost })
    .from(claimSchema)
    .where(
      and(
        eq(claimSchema.platformKey, detail.platformKey),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.rejectedAt),
        isNotNull(claimSchema.validatedAt),
      ),
    );
  const hosts = [
    ...new Set(claims.flatMap((claim) => (claim.host ? [claim.host.trim().toLowerCase()] : []))),
  ];
  const results = await Promise.all(hosts.slice(0, lookupLimit).map(researchHost));

  return {
    case: { id: detail.id, number: detail.number, name: detail.name, stage: detail.status },
    claims: claims.length,
    drafts: results.flatMap((result) => result.drafts),
    noDraft: results.flatMap(({ host, problem }) => (problem ? [{ host, problem }] : [])),
  };
}
