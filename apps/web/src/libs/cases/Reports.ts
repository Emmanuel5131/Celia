import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { recordCaseEvent } from '@/libs/cases/CaseEvents';
import { advanceCase } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { caseAnalysisSchema, caseReportSchema, caseSchema } from '@/models/Schema';
import { describeCase, hashReport, parseDollars, readNewReport } from '@/utils/cases/Report';
import { unapprovedReviews } from '@/utils/cases/ReportReview';
import type { AgentReportReview, ReportReview } from '@/utils/cases/ReportReview';
import { ReportValidation } from '@/validations/ReportValidation';
import type { Report } from '@/validations/ReportValidation';

/** A saved report as the app shows it. */
export type ReportView = {
  /** The analysis it answers: one statement of the platform, with its own approved plan. */
  analysisId: string;
  /** The run number of that analysis, which names its page. */
  run: number;
  version: number;
  snapshot: Report;
  /** SHA-256 of the snapshot, as `0x` and 64 hex characters. */
  hash: string;
  /** ISO time it was saved. */
  savedAt: string;
  /** Where it is in review. Outside the staff area only approved reports are ever returned. */
  review: ReportReview;
  /** What the assistant's review found and its message to the person who decides, once it has reviewed. */
  agentReview: AgentReportReview | null;
};

/** One line of an analysis's report history. */
export type ReportVersion = { version: number; hash: string; savedAt: string };

/**
 * Reads the saved reports of a case, newest first. A row that no longer matches the report format (saved before the format
 * changed), or that belongs to no analysis, is left out rather than shown wrongly. Only approved reports are read, unless the
 * caller is the staff area and asks for the ones still in review as well; a report that was sent back is never read.
 * @param caseId - The case id.
 * @param options - What to read.
 * @param options.inReview - Also read the drafts and the reports the assistant has reviewed. Only the staff area sets it.
 * @returns The reports.
 */
async function readReports(caseId: string, options: { inReview?: boolean } = {}) {
  const rows = await db
    .select({
      analysisId: caseReportSchema.analysisId,
      run: caseAnalysisSchema.run,
      version: caseReportSchema.version,
      snapshot: caseReportSchema.snapshot,
      hash: caseReportSchema.hash,
      review: caseReportSchema.review,
      agentReview: caseReportSchema.agentReview,
      createdAt: caseReportSchema.createdAt,
    })
    .from(caseReportSchema)
    .innerJoin(caseAnalysisSchema, eq(caseReportSchema.analysisId, caseAnalysisSchema.id))
    .where(
      and(
        eq(caseReportSchema.caseId, caseId),
        options.inReview
          ? inArray(caseReportSchema.review, ['approved', ...unapprovedReviews])
          : eq(caseReportSchema.review, 'approved'),
      ),
    )
    .orderBy(desc(caseReportSchema.createdAt));

  return rows.flatMap((row): ReportView[] => {
    const parsed = ReportValidation.safeParse(row.snapshot);

    return parsed.success && row.analysisId
      ? [
          {
            analysisId: row.analysisId,
            run: row.run,
            version: row.version,
            snapshot: parsed.data,
            hash: row.hash,
            savedAt: row.createdAt.toISOString(),
            review: row.review,
            // The assistant's private note to staff is read only by the staff area, never with an approved report for others.
            agentReview: options.inReview ? row.agentReview : null,
          },
        ]
      : [];
  });
}

/**
 * A report for a case. With a run, the report of that analysis: the version asked for, or its newest. Without one, the newest
 * report of the case, whichever analysis it answers.
 * @param caseId - The case id.
 * @param which - The analysis run and version, either of which may be left out.
 * @param which.run - The analysis run number.
 * @param which.version - The version of that analysis's report.
 * @param which.inReview - Also look at reports still in review. Only the staff area sets it.
 * @returns The report, or null when there is none.
 */
export async function getReport(
  caseId: string,
  which: { run?: number; version?: number; inReview?: boolean } = {},
) {
  const reports = await readReports(caseId, { inReview: which.inReview });
  const ofRun = reports.filter((report) => which.run === undefined || report.run === which.run);

  return (
    (which.version === undefined
      ? ofRun[0]
      : ofRun.find((report) => report.version === which.version)) ?? null
  );
}

/**
 * The newest report of every analysis of a case, in the order the analyses were approved.
 * @param caseId - The case id.
 * @param options - What to read.
 * @param options.inReview - Also read reports still in review. Only the staff area sets it.
 * @returns One report for each analysis that has one.
 */
export async function listLatestReports(caseId: string, options: { inReview?: boolean } = {}) {
  const reports = await readReports(caseId, options);
  const seen = new Set<string>();

  return reports
    .filter((report) => {
      const first = !seen.has(report.analysisId);
      seen.add(report.analysisId);

      return first;
    })
    .toSorted((a, b) => a.run - b.run);
}

/**
 * Every saved version of one analysis's report, newest first, for the history on its page.
 * @param caseId - The case id.
 * @param run - The analysis run number.
 * @param options - What to read.
 * @param options.inReview - Also list versions still in review. Only the staff area sets it.
 * @returns The versions.
 */
export async function listReportVersions(
  caseId: string,
  run: number,
  options: { inReview?: boolean } = {},
): Promise<ReportVersion[]> {
  const reports = await readReports(caseId, options);

  return reports
    .filter((report) => report.run === run)
    .map(({ version, hash, savedAt }) => ({ version, hash, savedAt }));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Makes a report the one the case shows: the case carries its own one-line description, kept in step with the newest approved
 * report of any analysis, and the case moves on and its team and claimants are told. It runs only when a report is approved, so a
 * draft changes nothing anyone outside the staff area can see.
 * @param tx - The transaction the approval runs in.
 * @param caseId - The case id.
 * @param snapshot - The approved findings.
 */
async function publishReport(tx: Transaction, caseId: string, snapshot: Report) {
  await tx
    .update(caseSchema)
    .set({
      description: describeCase(snapshot),
      estimatedLossUsd: snapshot.estimate?.lossUsd ?? parseDollars(snapshot.estimate?.losses),
    })
    .where(eq(caseSchema.id, caseId));
  await advanceCase(tx, caseId);

  await recordCaseEvent(tx, caseId, 'report_saved');
}

/**
 * Saves a new version of an analysis's report. Earlier versions are kept, never edited: the newest is shown, and the older ones
 * remain as the record of what was said before. Versions are counted for each analysis, so a correction to one statement's
 * report does not renumber another's. A report a person saves is approved at once and published; one an assistant saves is only a
 * draft, which changes nothing outside the staff area until it has been reviewed and a person approves it.
 * @param options - What to save.
 * @param options.caseId - The case id.
 * @param options.analysisId - The analysis the report answers.
 * @param options.snapshot - The checked findings.
 * @param options.hash - The snapshot's hash.
 * @param options.savedBy - The Clerk user id of the staff member.
 * @param options.review - `approved` for a report a person saved, `drafted` for one an assistant saved.
 * @param options.record - Written in the same transaction, such as the staff audit row, so the save and its record stand or fall
 *   together.
 */
async function saveReport(options: {
  caseId: string;
  analysisId: string;
  snapshot: Report;
  hash: string;
  savedBy: string;
  review: 'approved' | 'drafted';
  record?: (tx: Transaction) => Promise<void>;
}) {
  await db.transaction(async (tx) => {
    await tx.insert(caseReportSchema).values({
      caseId: options.caseId,
      analysisId: options.analysisId,
      // The next number is worked out in the same statement; the unique index stops two saves taking the same one.
      version: sql`(select coalesce(max(${caseReportSchema.version}), 0) + 1 from ${caseReportSchema} where ${caseReportSchema.analysisId} = ${options.analysisId})`,
      snapshot: options.snapshot,
      hash: options.hash,
      savedBy: options.savedBy,
      review: options.review,
      ...(options.review === 'approved' && { decidedBy: options.savedBy, decidedAt: new Date() }),
    });

    if (options.review === 'approved') {
      await publishReport(tx, options.caseId, options.snapshot);
    }

    await options.record?.(tx);
  });
}

/**
 * Checks findings and saves them as a new version of one analysis's report, with the staff audit row in the same transaction. The
 * analysis is the approved plan the report names by its commitment, so a report cannot answer a plan staff did not approve. The
 * findings are checked here, whoever sends them, so the staff area and the MCP server hold a report to the same rules. A save from
 * the MCP server is a draft that still needs the assistant's review and a person's yes.
 * @param options - What to save.
 * @param options.caseId - The case id.
 * @param options.json - The findings as parsed JSON.
 * @param options.actor - The staff member saving.
 * @param options.via - Where the save came from, kept in the audit row.
 * @returns The problem found (see `readNewReport`; `analysis` also when no approved plan of the case has that commitment), or null
 *   when saved.
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

  const [analysis] = await db
    .select({ id: caseAnalysisSchema.id, run: caseAnalysisSchema.run })
    .from(caseAnalysisSchema)
    .where(
      and(
        eq(caseAnalysisSchema.caseId, options.caseId),
        eq(caseAnalysisSchema.commitment, checked.report.method.commitment ?? ''),
      ),
    );

  if (!analysis) {
    return 'analysis' as const;
  }

  await saveReport({
    caseId: options.caseId,
    analysisId: analysis.id,
    snapshot: checked.report,
    hash: hashReport(checked.report),
    savedBy: options.actor.id,
    review: options.via === 'mcp' ? 'drafted' : 'approved',
    record: async (tx) => {
      await recordStaffAction(tx, {
        actor: options.actor,
        action: 'report_saved',
        target: { type: 'case', id: options.caseId },
        details: { run: String(analysis.run), ...(options.via && { via: options.via }) },
      });
    },
  });

  return null;
}

/**
 * Finds one report version of a case that is still in a given review state.
 * @param caseId - The case id.
 * @param which - The analysis run and the version.
 * @param which.run - The analysis run number.
 * @param which.version - The version of that analysis's report.
 * @param state - The state it must be in.
 * @returns The row, or undefined when there is no such report in that state.
 */
async function findInState(
  caseId: string,
  which: { run: number; version: number },
  state: ReportReview,
) {
  const [row] = await db
    .select({
      id: caseReportSchema.id,
      snapshot: caseReportSchema.snapshot,
    })
    .from(caseReportSchema)
    .innerJoin(caseAnalysisSchema, eq(caseReportSchema.analysisId, caseAnalysisSchema.id))
    .where(
      and(
        eq(caseReportSchema.caseId, caseId),
        eq(caseAnalysisSchema.run, which.run),
        eq(caseReportSchema.version, which.version),
        eq(caseReportSchema.review, state),
      ),
    );

  return row;
}

/**
 * Records the assistant's review of a draft, with the message it prepared for the person who decides. The report moves from
 * `drafted` to `agent_reviewed` and is still not shown outside the staff area. Only a draft can be reviewed, and only once.
 * @param options - What the review found.
 * @param options.caseId - The case id.
 * @param options.run - The analysis run number.
 * @param options.version - The version of that analysis's report.
 * @param options.verdict - `pass`, or `concerns` when the person should look closely.
 * @param options.message - The assistant's message to the person: what it checked, what to look at and what it recommends.
 * @param options.actor - The staff member whose assistant reviewed.
 * @returns `ok`, or `state` when there is no such draft waiting for review.
 */
export async function reviewReportByAgent(options: {
  caseId: string;
  run: number;
  version: number;
  verdict: 'pass' | 'concerns';
  message: string;
  actor: { id: string; email: string | null };
}) {
  const draft = await findInState(options.caseId, options, 'drafted');

  if (!draft) {
    return 'state' as const;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(caseReportSchema)
      .set({
        review: 'agent_reviewed',
        agentReview: {
          verdict: options.verdict,
          message: options.message,
          at: new Date().toISOString(),
        },
      })
      .where(and(eq(caseReportSchema.id, draft.id), eq(caseReportSchema.review, 'drafted')));
    await recordStaffAction(tx, {
      actor: options.actor,
      action: 'report_reviewed',
      target: { type: 'case', id: options.caseId },
      details: {
        run: String(options.run),
        version: String(options.version),
        verdict: options.verdict,
        via: 'mcp',
      },
    });
  });

  return 'ok' as const;
}

/**
 * A person's answer to a report the assistant reviewed. Yes approves it: it becomes the report the case shows and the case moves
 * on. No sends it back, so it is never shown and the statement waits for a new report. A report nobody has reviewed yet cannot be
 * answered, so the assistant's review and its message always come first. This is the staff area's only way to publish an
 * assistant's report, and no MCP tool calls it.
 * @param options - The answer.
 * @param options.caseId - The case id.
 * @param options.run - The analysis run number.
 * @param options.version - The version of that analysis's report.
 * @param options.approve - True to approve, false to send it back.
 * @param options.actor - The staff member answering.
 * @returns `ok`, or `state` when the report is not waiting for a person.
 */
export async function answerReport(options: {
  caseId: string;
  run: number;
  version: number;
  approve: boolean;
  actor: { id: string; email: string | null };
}) {
  const waiting = await findInState(options.caseId, options, 'agent_reviewed');

  if (!waiting) {
    return 'state' as const;
  }

  await db.transaction(async (tx) => {
    const [changed] = await tx
      .update(caseReportSchema)
      .set({
        review: options.approve ? 'approved' : 'sent_back',
        decidedBy: options.actor.id,
        decidedAt: new Date(),
      })
      .where(
        and(eq(caseReportSchema.id, waiting.id), eq(caseReportSchema.review, 'agent_reviewed')),
      )
      .returning({ id: caseReportSchema.id });

    if (!changed) {
      return;
    }

    if (options.approve) {
      await publishReport(tx, options.caseId, waiting.snapshot);
    }

    await recordStaffAction(tx, {
      actor: options.actor,
      action: options.approve ? 'report_approved' : 'report_sent_back',
      target: { type: 'case', id: options.caseId },
      details: { run: String(options.run), version: String(options.version) },
    });
  });

  return 'ok' as const;
}

/**
 * The reports of a case that are still in review, for the staff area and the staff MCP tools: drafts waiting for the assistant's
 * review and reviewed reports waiting for a person.
 * @param caseId - The case id.
 * @returns The reports in review, oldest first.
 */
export async function listReportsInReview(caseId: string) {
  const reports = await readReports(caseId, { inReview: true });

  return reports.filter((report) => report.review !== 'approved').toReversed();
}
