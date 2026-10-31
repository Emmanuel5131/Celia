import { max } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { caseAnalysisSchema, caseReportSchema } from '@/models/Schema';
import { analysisStatus } from '@/utils/analysis/Status';
import type { AnalysisStatus } from '@/utils/analysis/Status';

/**
 * Tells where every case stands with its analysis, for the cases list: two grouped reads, not one per case.
 * @returns The status of each case, by case id. A case missing from the map needs a plan.
 */
export async function listAnalysisStatuses() {
  const [approvals, reports] = await Promise.all([
    db
      .select({ caseId: caseAnalysisSchema.caseId, at: max(caseAnalysisSchema.approvedAt) })
      .from(caseAnalysisSchema)
      .groupBy(caseAnalysisSchema.caseId),
    db
      .select({ caseId: caseReportSchema.caseId, at: max(caseReportSchema.createdAt) })
      .from(caseReportSchema)
      .groupBy(caseReportSchema.caseId),
  ]);

  const approvedAt = new Map(approvals.map((row) => [row.caseId, row.at?.toISOString() ?? null]));
  const reportAt = new Map(reports.map((row) => [row.caseId, row.at?.toISOString() ?? null]));
  const statuses = new Map<string, AnalysisStatus>();

  for (const caseId of new Set([...approvedAt.keys(), ...reportAt.keys()])) {
    statuses.set(
      caseId,
      analysisStatus({
        approvedAt: approvedAt.get(caseId) ?? null,
        reportAt: reportAt.get(caseId) ?? null,
      }),
    );
  }

  return statuses;
}
