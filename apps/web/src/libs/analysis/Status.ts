import { and, count, countDistinct, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { caseAnalysisSchema, caseReportSchema } from '@/models/Schema';
import { analysisStatus } from '@/utils/analysis/Status';
import type { AnalysisStatus } from '@/utils/analysis/Status';

/**
 * Tells where every case stands with its research, for the cases list: two grouped reads, not one per case.
 * @returns The status of each case, by case id. A case missing from the map needs a plan.
 */
export async function listAnalysisStatuses() {
  const [planned, reported] = await Promise.all([
    db
      .select({ caseId: caseAnalysisSchema.caseId, total: count() })
      .from(caseAnalysisSchema)
      .groupBy(caseAnalysisSchema.caseId),
    db
      .select({
        caseId: caseReportSchema.caseId,
        total: countDistinct(caseReportSchema.analysisId),
      })
      .from(caseReportSchema)
      .where(and(isNotNull(caseReportSchema.analysisId), eq(caseReportSchema.review, 'approved')))
      .groupBy(caseReportSchema.caseId),
  ]);

  const plannedBy = new Map(planned.map((row) => [row.caseId, row.total]));
  const reportedBy = new Map(reported.map((row) => [row.caseId, row.total]));
  const statuses = new Map<string, AnalysisStatus>();

  for (const caseId of new Set([...plannedBy.keys(), ...reportedBy.keys()])) {
    statuses.set(
      caseId,
      analysisStatus({
        planned: plannedBy.get(caseId) ?? 0,
        reported: reportedBy.get(caseId) ?? 0,
      }),
    );
  }

  return statuses;
}
