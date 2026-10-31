import type { Brief, PreflightProblem } from '@celia/core';
import { useFormatter, useTranslations } from 'next-intl';
import { CheckTable } from '@/components/cases/CheckTable';
import { ReportPdfButton } from '@/components/cases/ReportPdfButton';
import { PageSection } from '@/components/layout/PageSection';
import { AnalysisBriefSummary } from '@/components/staff/AnalysisParts';
import { AnalysisPlan } from '@/components/staff/AnalysisPlan';
import { AssistantPrompt } from '@/components/staff/AssistantPrompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { StoredStatement } from '@/libs/analysis/Statements';
import type { ReportView } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';
import { checkRows } from '@/utils/cases/ReportChecks';

type PlanData = {
  caseId: string;
  statements: StoredStatement[];
  problems: PreflightProblem[];
  brief: Brief | null;
};

/**
 * The step staff take first: plan the analysis, inside one outlined card.
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
 * @param props.latest.run - Its run number.
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
      <AssistantPrompt text={t('agent_prompt', { number: props.number, id: props.caseId })} />
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
 * The saved report: when it was saved, the checks it holds, and a way into the full analysis.
 * @param props - The section props.
 * @param props.caseId - The case id.
 * @param props.report - The newest report.
 * @returns The section.
 */
export function ReportSection(props: { caseId: string; report: ReportView }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const analysis = `/dashboard/cases/${props.caseId}/analysis`;
  const { report } = props;

  return (
    <PageSection
      title={t('report_title')}
      description={t('report_saved_text', {
        version: report.version,
        date: format.dateTime(new Date(report.savedAt), { dateStyle: 'medium' }),
        checks: report.snapshot.checks.length,
      })}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ReportPdfButton caseId={props.caseId} version={report.version} />
          <Button asChild variant="outline">
            <Link href={`${analysis}?version=${report.version}`}>{t('analysis_open')}</Link>
          </Button>
        </div>
      }
    >
      <CheckTable
        rows={checkRows(
          report.snapshot,
          (testId) => `${analysis}?version=${report.version}#test-${testId}`,
        )}
        searchPlaceholder={t('analysis_search')}
      />
    </PageSection>
  );
}

/**
 * For a case that already has a report: planning another analysis stays out of the way until staff ask for it.
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
