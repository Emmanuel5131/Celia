import { describe, expect, it } from 'vitest';
import {
  archiveDate,
  archiveDraft,
  claimantLabel,
  daysBetween,
  publicDomain,
  registrationDraft,
  registryNames,
} from '@/utils/claims/ClaimResearch';

const now = new Date('2026-10-31T12:00:00Z');

describe(registrationDraft, () => {
  it('states the registration date and age with a link to the registry lookup', () => {
    expect(
      registrationDraft('example.com', { registeredOn: '2026-09-01T10:00:00Z', daysOld: 60 }, now),
    ).toStrictEqual({
      type: 'link',
      title: 'example.com: domain registration',
      note: 'The public domain registry shows example.com was registered on 2026-09-01, 60 days before this check.',
      sourceUrl: 'https://lookup.icann.org/en/lookup?name=example.com',
      capturedOn: '2026-10-31',
    });
  });

  it('gives no draft when the registry has no registration date', () => {
    expect(registrationDraft('example.com', { registeredOn: null, daysOld: null }, now)).toBeNull();
  });

  it('never says why a domain was registered', () => {
    const draft = registrationDraft('example.com', { registeredOn: '2026-09-01', daysOld: 1 }, now);

    expect(draft?.note).not.toMatch(/fraud|scam|fake/iu);
  });
});

describe(archiveDraft, () => {
  it('links to the first saved copy itself', () => {
    expect(archiveDraft('example.com', '20190402101500', now)).toMatchObject({
      title: 'example.com: first saved copy',
      sourceUrl: 'https://web.archive.org/web/20190402101500/example.com',
      capturedOn: '2026-10-31',
    });
  });
});

describe(archiveDate, () => {
  it('reads the day from a capture stamp', () => {
    expect(archiveDate('20190402101500')).toBe('2019-04-02');
  });
});

describe(publicDomain, () => {
  it('cleans a typed address down to the domain', () => {
    expect(publicDomain(' https://www.Example.com/path?x=1 ')).toBe('example.com');
  });

  it.each(['localhost', '127.0.0.1', '10.0.0.1:8080', 'intranet', 'a b.com', ''])(
    'refuses %j',
    (host) => {
      expect(publicDomain(host)).toBeNull();
    },
  );
});

describe(registryNames, () => {
  it('walks up to the registered domain', () => {
    expect(registryNames('app.pay.example.com')).toStrictEqual([
      'app.pay.example.com',
      'pay.example.com',
      'example.com',
    ]);
  });

  it('keeps a plain domain as it is', () => {
    expect(registryNames('example.com')).toStrictEqual(['example.com']);
  });
});

describe(daysBetween, () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-01T00:00:00Z', new Date('2026-10-31T12:00:00Z'))).toBe(30);
  });

  it('returns null for a bad time', () => {
    expect(daysBetween('soon', new Date())).toBeNull();
  });
});

describe(claimantLabel, () => {
  const id = '6f1c2f0e-8f43-4a6b-9b52-1d0c1b9d7a11';

  it('names a claimant claimant_ and eight hex digits', () => {
    expect(claimantLabel(id)).toMatch(/^claimant_[\da-f]{8}$/u);
  });

  it('gives the same claim the same label every time', () => {
    expect(claimantLabel(id)).toBe(claimantLabel(id));
  });

  it('gives different claims different labels', () => {
    expect(claimantLabel(id)).not.toBe(claimantLabel('6f1c2f0e-8f43-4a6b-9b52-1d0c1b9d7a12'));
  });

  it('does not carry the claim id', () => {
    expect(claimantLabel(id)).not.toContain(id.slice(0, 8));
  });
});
