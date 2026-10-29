import { desc, eq, sql } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { recordCaseEvent } from '@/libs/cases/CaseEvents';
import { advanceCase } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { caseReportSchema, caseSchema } from '@/models/Schema';
import { describeCase, hashReport, parseDollars, readNewReport } from '@/utils/cases/Report';
import { ReportValidation } from '@/validations/ReportValidation';
import type { Report } from '@/validations/ReportValidation';

/** A saved report as the app shows it. */
export type ReportView = {
  version: number;
  snapshot: Report;
  /** SHA-256 of the snapshot, as `0x` and 64 hex characters. */
  hash: string;
  /** ISO time it was saved. */
  savedAt: string;
};

/** One line of a case's report history. */
export type ReportVersion = { version: number; hash: string; savedAt: string };

/**
 * Reads the saved reports of a case, newest first. A row that no longer matches the report format (saved before the format
 * changed) is left out rather than shown wrongly.
 * @param caseId - The case id.
 * @returns The reports.
 */
async function readReports(caseId: string) {
  const rows = await db
    .select()
    .from(caseReportSchema)
    .where(eq(caseReportSchema.caseId, caseId))
    .orderBy(desc(caseReportSchema.version));

  return rows.flatMap((row): ReportView[] => {
    const parsed = ReportValidation.safeParse(row.snapshot);

    return parsed.success
      ? [
          {
            version: row.version,
            snapshot: parsed.data,
            hash: row.hash,
            savedAt: row.createdAt.toISOString(),
          },
        ]
      : [];
  });
}

/**
 * A report for a case: the version asked for, or the newest.
 * @param caseId - The case id.
 * @param version - The version number, or nothing for the newest.
 * @returns The report, or null when there is none.
 */
export async function getReport(caseId: string, version?: number) {
  const reports = await readReports(caseId);

  return (
    (version === undefined ? reports[0] : reports.find((report) => report.version === version)) ??
    null
  );
}

/**
 * Every saved version of a case's report, newest first, for the history on the analysis page.
 * @param caseId - The case id.
 * @returns The versions.
 */
export async function listReportVersions(caseId: string): Promise<ReportVersion[]> {
  const reports = await readReports(caseId);

  return reports.map(({ version, hash, savedAt }) => ({ version, hash, savedAt }));
}

/**
 * Saves a new version of a case's report. Earlier versions are kept, never edited: the newest is shown, and the older ones
 * remain as the record of what was said before.
 * @param options - What to save.
 * @param options.caseId - The case id.
 * @param options.snapshot - The checked findings.
 * @param options.hash - The snapshot's hash.
 * @param options.savedBy - The Clerk user id of the staff member.
 * @param options.record - Written in the same transaction, such as the staff audit row, so the save and its record stand or fall
 *   together.
 */
async function saveReport(options: {
  caseId: string;
  snapshot: Report;
  hash: string;
  savedBy: string;
  record?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>;
}) {
  await db.transaction(async (tx) => {
    await tx.insert(caseReportSchema).values({
      caseId: options.caseId,
      // The next number is worked out in the same statement; the unique index stops two saves taking the same one.
      version: sql`(select coalesce(max(${caseReportSchema.version}), 0) + 1 from ${caseReportSchema} where ${caseReportSchema.caseId} = ${options.caseId})`,
      snapshot: options.snapshot,
      hash: options.hash,
      savedBy: options.savedBy,
    });
    // The case carries its own one-line description, kept in step with the newest report.
    await tx
      .update(caseSchema)
      .set({
        description: describeCase(options.snapshot),
        estimatedLossUsd:
          options.snapshot.estimate?.lossUsd ?? parseDollars(options.snapshot.estimate?.losses),
      })
      .where(eq(caseSchema.id, options.caseId));
    await advanceCase(tx, options.caseId);

    await recordCaseEvent(tx, options.caseId, 'report_saved');
    await options.record?.(tx);
  });
}

/**
 * Checks findings and saves them as a new version of a case's report, with the staff audit row in the same transaction. The
 * findings are checked here, whoever sends them, so the staff area and the MCP server hold a report to the same rules.
 * @param options - What to save.
 * @param options.caseId - The case id.
 * @param options.json - The findings as parsed JSON.
 * @param options.actor - The staff member saving.
 * @param options.via - Where the save came from, kept in the audit row.
 * @returns The problem found (see `readNewReport`), or null when saved.
 */
export async function saveCheckedReport(options: {
  caseId: string;
  json: unknown;
  actor: { id: string; email: string | null };
  via?: 'mcp';
}) {
  const checked = readNewReport(options.json);

  if ('problem' in checked) {
    return checked.problem;
  }

  await saveReport({
    caseId: options.caseId,
    snapshot: checked.report,
    hash: hashReport(checked.report),
    savedBy: options.actor.id,
    record: async (tx) => {
      await recordStaffAction(tx, {
        actor: options.actor,
        action: 'report_saved',
        target: { type: 'case', id: options.caseId },
        details: options.via ? { via: options.via } : undefined,
      });
    },
  });

  return null;
}
