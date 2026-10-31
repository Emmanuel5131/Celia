import type { BriefInput, ChainAddress } from '@celia/core';
import { and, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { listStatements } from '@/libs/analysis/Statements';
import { getCase } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { caseAnalysisSchema, claimAddressSchema, claimSchema } from '@/models/Schema';

/**
 * Reads what the brief builder needs about a case, and only the platform's side of it: where the money went, the token contracts,
 * the website, the fraud type, and when the earliest confirmed payment was made. It never selects a claimant's wallet, name,
 * statement or proof. The payment time is read out of the stored check in SQL, so the check's `from` address (a claimant's wallet)
 * does not even reach this process.
 * @param caseId - The case id.
 * @returns The input, or null when there is no such case.
 */
export async function loadBriefInput(caseId: string): Promise<BriefInput | null> {
  const detail = await getCase(caseId);

  if (!detail) {
    return null;
  }

  const claims = await db
    .select({
      id: claimSchema.id,
      chain: claimSchema.chain,
      fraudType: claimSchema.fraudType,
      destination: claimSchema.destinationAddress,
      contract: claimSchema.tokenContract,
      host: claimSchema.platformHost,
      firstOn: claimSchema.firstPaymentOn,
      lastOn: claimSchema.lastPaymentOn,
      paidAt: sql<string | null>`${claimSchema.txCheck}->'facts'->>'at'`,
    })
    .from(claimSchema)
    .where(
      and(
        eq(claimSchema.platformKey, detail.platformKey),
        eq(claimSchema.status, 'submitted'),
        isNull(claimSchema.rejectedAt),
        isNotNull(claimSchema.validatedAt),
      ),
    );

  const addresses =
    claims.length === 0
      ? []
      : await db
          .select({ chain: claimAddressSchema.chain, address: claimAddressSchema.address })
          .from(claimAddressSchema)
          .where(
            and(
              eq(claimAddressSchema.role, 'receiving'),
              inArray(
                claimAddressSchema.claimId,
                claims.map((claim) => claim.id),
              ),
            ),
          );

  const [statements, [runs]] = await Promise.all([
    listStatements(caseId),
    db
      .select({ total: count() })
      .from(caseAnalysisSchema)
      .where(eq(caseAnalysisSchema.caseId, caseId)),
  ]);

  const receiving: ChainAddress[] = [
    ...addresses,
    ...claims.flatMap((claim) =>
      claim.destination ? [{ chain: claim.chain, address: claim.destination }] : [],
    ),
  ];
  // Payment times come from a chain check when there is one, and from the dates the claimant gave otherwise. They only place the
  // window, so a claimant's own date is good enough here; the chain is what the analysis reads.
  const paid = claims
    .flatMap((claim) =>
      [claim.paidAt, claim.firstOn, claim.lastOn].filter((value) => value !== null),
    )
    .toSorted((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    caseId: detail.id,
    caseNumber: detail.number,
    caseName: detail.name,
    status: detail.status,
    confirmedClaims: detail.confirmed,
    fraudTypes: claims.map((claim) => claim.fraudType),
    receiving,
    tokenContracts: claims.flatMap((claim) =>
      claim.contract ? [{ chain: claim.chain, address: claim.contract }] : [],
    ),
    hosts: claims.flatMap((claim) => (claim.host ? [claim.host] : [])),
    firstPaymentAt: paid[0] ?? null,
    lastPaymentAt: paid.at(-1) ?? null,
    statements: statements.map(({ kind, text, sourceUrl, saidOn }) => ({
      kind,
      text,
      sourceUrl,
      ...(saidOn && { saidOn }),
    })),
    runs: runs?.total ?? 0,
    now: new Date(),
  };
}
