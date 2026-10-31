import type { Brief, PreflightProblem } from '@celia/core';
import { useFormatter, useTranslations } from 'next-intl';
import { CheckTable } from '@/components/cases/CheckTable';
import { ReportNotebookButton } from '@/components/cases/ReportNotebookButton';
import { ReportPdfButton } from '@/components/cases/ReportPdfButton';
import { PageSection } from '@/components/layout/PageSection';
import { AnalysisBriefSummary } from '@/components/staff/AnalysisParts';
import { AnalysisPlan } from '@/components/staff/AnalysisPlan';
import { AssistantPrompt } from '@/components/staff/AssistantPrompt';
import { ReportAnswer } from '@/components/staff/ReportAnswer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReportView } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';
import { checkRows } from '@/utils/cases/ReportChecks';

type PlanData = {
  caseId: string;
  statementId: string;
  problems: PreflightProblem[];
  brief: Brief | null;
};

/**
 * The step staff take first for a statement: plan its research, inside one outlined card.
 * @param props - The section props.
 * @param props.plan - What the plan needs: the case, its statements, what is missing and the brief.
 * @returns The section.
 */
export function PlanSection(props: { plan: PlanData }) {
  const t = useTranslations('Staff');

  return (
    <PageSection title={t('plan_title')} description={t('plan_text')}>
      <Card variant="outline">
        <CardContent>
          <AnalysisPlan {...props.plan} />
        </CardContent>
      </Card>
    </PageSection>
  );
}

/**
 * After a plan is approved: the sentence to give the assistant, and what was approved in case staff want to look.
 * @param props - The section props.
 * @param props.caseId - The case id.
 * @param props.number - The case number, such as `CB-0142`.
 * @param props.latest - The newest approved plan.
 * @param props.latest.run - Its run number, which names the analysis.
 * @param props.latest.approvedAt - When it was approved, as an ISO time.
 * @param props.latest.brief - What was approved.
 * @returns The section.
 */
export function AgentSection(props: {
  caseId: string;
  number: string;
  latest: { run: number; approvedAt: string; brief: Brief };
}) {
  const t = useTranslations('Staff');
  const format = useFormatter();

  return (
    <PageSection
      title={t('agent_title')}
      description={t('agent_text', {
        run: props.latest.run,
        date: format.dateTime(new Date(props.latest.approvedAt), { dateStyle: 'medium' }),
      })}
    >
      <AssistantPrompt
        text={t('agent_prompt', {
          number: props.number,
          id: props.caseId,
          run: props.latest.run,
        })}
      />
      <details className="border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">{t('plan_approved_view')}</summary>
        <div className="mt-4">
          <AnalysisBriefSummary brief={props.latest.brief} />
        </div>
      </details>
    </PageSection>
  );
}

/**
 * The saved report of one statement: when it was saved, its verdict, and the way into its analysis page.
 * @param props - The section props.
 * @param props.caseId - The case id.
 * @param props.report - The newest report.
 * @returns The section.
 */
export function ReportSection(props: { caseId: string; report: ReportView }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { report } = props;
  const analysis = `/dashboard/cases/${props.caseId}/analysis/${report.run}`;

  return (
    <PageSection
      title={t('report_title')}
      description={t('report_saved_text', {
        version: report.version,
        date: format.dateTime(new Date(report.savedAt), { dateStyle: 'medium' }),
      })}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ReportNotebookButton report={report} />
          <ReportPdfButton caseId={props.caseId} run={report.run} version={report.version} />
          <Button asChild variant="outline">
            <Link href={`${analysis}?version=${report.version}`}>{t('analysis_open')}</Link>
          </Button>
        </div>
      }
    >
      <CheckTable rows={checkRows(report.snapshot)} />
    </PageSection>
  );
}

/**
 * A report that has been saved but is not yet the case's report. First the assistant reviews the draft and writes a message for
 * the person; then the person reads that message and the findings and answers yes or no. Until then nothing outside the staff
 * area shows it.
 * @param props - The section props.
 * @param props.caseId - The case id.
 * @param props.number - The case number, such as `CB-0142`.
 * @param props.report - The report in review.
 * @returns The section.
 */
export function ReviewSection(props: { caseId: string; number: string; report: ReportView }) {
  const t = useTranslations('Staff');
  const { report } = props;
  const review = report.agentReview;

  return (
    <PageSection
      title={t('review_title')}
      description={t(review ? 'review_reviewed_text' : 'review_drafted_text', {
        version: report.version,
      })}
    >
      {review ? (
        <Card variant="outline">
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{t('review_message_title')}</p>
              <Badge variant="muted">{t(`review_verdict_${review.verdict}`)}</Badge>
            </div>
            <p className="max-w-prose text-sm whitespace-pre-line">{review.message}</p>
            <ReportAnswer caseId={props.caseId} run={report.run} version={report.version} />
          </CardContent>
        </Card>
      ) : (
        <AssistantPrompt
          text={t('review_prompt', {
            number: props.number,
            id: props.caseId,
            run: report.run,
            version: report.version,
          })}
        />
      )}
      <CheckTable rows={checkRows(report.snapshot)} />
    </PageSection>
  );
}

/**
 * For a statement that already has a report: planning its research again stays out of the way until staff ask for it.
 * @param props - The section props.
 * @param props.plan - What the plan needs.
 * @returns The folded section.
 */
export function ReplanSection(props: { plan: PlanData }) {
  const t = useTranslations('Staff');

  return (
    <details className="border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">{t('again_title')}</summary>
      <div className="mt-4 grid gap-8">
        <p className="text-sm text-ink-muted">{t('plan_text')}</p>
        <AnalysisPlan {...props.plan} />
      </div>
    </details>
  );
}
