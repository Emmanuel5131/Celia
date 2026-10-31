import type { ClaimantRow } from '@/components/cases/CaseClaimantsTable';
import { listCaseClaims } from '@/libs/cases/CaseClaims';
import { claimantNames } from '@/libs/claims/ClaimantNames';

/**
 * The claims in a case as table rows, with each person's name from Clerk or a numbered label when there is none.
 * @param caseId - The case id.
 * @param label - Makes the label for a person with no name, from their number.
 * @returns The rows.
 */
export async function loadClaimantRows(caseId: string, label: (number: number) => string) {
  const claims = await listCaseClaims(caseId);
  const names = await claimantNames(claims.map((claim) => claim.userId));

  return claims.map((claim, index): ClaimantRow => ({
    id: claim.id,
    caseId,
    name: names.get(claim.userId) ?? label(index + 1),
    fraudType: claim.fraudType,
    chain: claim.chain,
    reference: claim.walletAddress ?? claim.txHash ?? '',
    amountLost: claim.amountLost,
    country: claim.country,
    ownership: claim.ownership,
    submittedAt: claim.submittedAt?.toISOString() ?? null,
  }));
}
