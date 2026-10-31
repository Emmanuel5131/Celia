import { createHash } from 'node:crypto';
import type { caseEvidenceSchema } from '@/models/Schema';

const day = (now: number, ago: number) =>
  new Date(now - ago * 86_400_000).toISOString().slice(0, 10);

/**
 * Sample evidence for a case that has a statement: three off-chain links and three on-chain items. The values come from a hash of
 * the platform key and not from the seed's random numbers, so adding evidence does not change the rest of a reseed. Off-chain rows
 * are links: a made-up IPFS file would not open, so the sample has none. Every address and link is invented.
 * @param options - The case.
 * @param options.caseId - The case id.
 * @param options.key - The platform key.
 * @param options.statementId - The statement the first items back.
 * @param options.now - The time the seed started, in milliseconds.
 * @returns The rows to insert.
 */
export function evidenceFor(options: {
  caseId: string;
  key: string;
  statementId: string;
  now: number;
}) {
  const seed = createHash('sha256').update(options.key).digest('hex').repeat(2);
  const base = { caseId: options.caseId, createdBy: 'seed_staff' } as const;
  const reviewedAt = new Date(options.now - 5 * 86_400_000);
  const reviewed = { reviewState: 'reviewed', reviewedBy: 'seed_staff', reviewedAt } as const;

  return [
    {
      ...base,
      type: 'link',
      title: 'Launch post',
      note: 'The platform’s launch post, saying withdrawals are open at any time.',
      sourceUrl: `https://social.example/${options.key}/status/${seed.slice(0, 12)}`,
      capturedOn: day(options.now, 40),
      statementId: options.statementId,
      ...reviewed,
      reviewNote:
        'Shows the platform saying withdrawals are open at any time. The account is the one linked from its site.',
    },
    {
      ...base,
      type: 'link',
      title: 'Archived terms page',
      note: 'The terms page as it stood on the capture date, with the withdrawal rules.',
      sourceUrl: `https://archive.example/${options.key}/terms`,
      capturedOn: day(options.now, 35),
      statementId: options.statementId,
      ...reviewed,
      reviewNote: 'The archived copy matches the live page on the capture date.',
    },
    {
      ...base,
      type: 'link',
      title: 'Support chat export',
      note: 'A claimant-independent copy of the public support channel on the day withdrawals slowed.',
      sourceUrl: `https://chat.example/${options.key}/support`,
      capturedOn: day(options.now, 12),
      reviewState: 'unverified',
      reviewNote: 'The channel is public but its owner could not be confirmed.',
      reviewedBy: 'seed_staff',
      reviewedAt,
    },
    {
      ...base,
      type: 'wallet',
      title: 'Main deposit wallet',
      note: 'Receives most of the payments the claimants name.',
      chain: 'ethereum',
      reference: `0x${seed.slice(12, 52)}`,
    },
    {
      ...base,
      type: 'transaction',
      title: 'Largest single deposit',
      note: 'The largest payment into the deposit wallet in the window.',
      chain: 'ethereum',
      reference: `0x${seed.slice(52, 116)}`,
    },
    {
      ...base,
      type: 'notebook',
      title: 'Withdrawals by day',
      note: 'The Sandworm notebook behind the withdrawals check.',
      sourceUrl: `https://sandworm.example/notebook/${seed.slice(116, 128)}`,
      statementId: options.statementId,
    },
  ] satisfies (typeof caseEvidenceSchema.$inferInsert)[];
}
