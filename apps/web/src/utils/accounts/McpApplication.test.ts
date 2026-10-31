import { describe, expect, it } from 'vitest';
import type { ApplicationInReview } from '@/libs/accounts/Applications';
import { applicationForMcp } from './McpApplication';

const item: ApplicationInReview = {
  id: 'user_1',
  name: 'Ada Lovelace',
  email: 'ada@firm.example',
  domain: 'own',
  kind: 'law_firm',
  organisation: 'Firm LLP',
  registrationNumber: '123',
  website: 'https://firm.example',
  contactRole: 'partner',
  jurisdictions: ['gb'],
  checks: {},
  lookups: null,
  lookedUpAt: null,
  readyBy: null,
  status: 'in_review',
  decisionNote: null,
  decidedAt: null,
  submittedAt: '2026-10-01T00:00:00.000Z',
  dueAt: '2026-10-08T00:00:00.000Z',
  overdue: false,
};

describe(applicationForMcp, () => {
  it('drops the name and email of the applicant', () => {
    const shaped = applicationForMcp(item);

    expect(shaped).not.toHaveProperty('name');
    expect(shaped).not.toHaveProperty('email');
  });

  it('keeps what staff check', () => {
    expect(applicationForMcp(item)).toMatchObject({ id: 'user_1', organisation: 'Firm LLP' });
  });
});
