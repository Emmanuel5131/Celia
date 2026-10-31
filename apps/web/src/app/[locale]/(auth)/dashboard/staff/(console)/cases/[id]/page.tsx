import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import {
  AgentSection,
  PlanSection,
  ReplanSection,
  ReportSection,
} from '@/components/staff/CaseSections';
import { CaseSteps } from '@/components/staff/CaseSteps';
import { OperatorsDialog } from '@/components/staff/OperatorsDialog';
import { ReportDialog } from '@/components/staff/ReportDialog';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/libs/accounts/Staff';
import { listApprovedBriefs, previewBrief } from '@/libs/analysis/Analysis';
import { listStatements } from '@/libs/analysis/Statements';
import { getCase, toCaseRow } from '@/libs/cases/Cases';
import { getReport } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';
import { analysisStatus } from '@/utils/analysis/Status';

type StaffCasePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: StaffCasePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return { title: t('case_page_title') };
}

export default async function StaffCasePage(props: StaffCasePageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  const [report, approved, statements, prepared] = await Promise.all([
    found.hasReport ? getReport(found.id) : null,
    listApprovedBriefs(found.id),
    listStatements(found.id),
    previewBrief(found.id),
  ]);
  const [latest] = approved;
  const status = analysisStatus({
    approvedAt: latest?.approvedAt ?? null,
    reportAt: report?.savedAt ?? null,
  });
  const row = toCaseRow(found);
  const plan = {
    caseId: found.id,
    statements,
    problems: prepared?.problems ?? [],
    brief: prepared?.brief ?? null,
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href="/dashboard/staff/cases">
          <ArrowLeftIcon aria-hidden="true" />
          {t('analysis_back')}
        </Link>
      </Button>
      <PageHeader
        title={found.name}
        description={
          <span>
            <span className="font-mono">{found.number}</span> ·{' '}
            {t('case_facts', { victims: found.claimants, jurisdictions: found.jurisdictions })}
          </span>
        }
      />
      <div className="grid gap-8">
        <CaseSteps status={status} />

        {status === 'needs_plan' && <PlanSection plan={plan} />}
        {status === 'agent_working' && latest && (
          <AgentSection caseId={found.id} number={found.number} latest={latest} />
        )}
        {status === 'report_saved' && report && <ReportSection caseId={found.id} report={report} />}
        {status === 'report_saved' && <ReplanSection plan={plan} />}

        <PageSection title={t('operators_section_title')} description={t('operators_section_text')}>
          <div className="flex flex-wrap items-center gap-4">
            {found.operators && <p className="max-w-prose text-sm">{found.operators}</p>}
            <OperatorsDialog row={row} />
          </div>
        </PageSection>

        <details className="border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">{t('manual_title')}</summary>
          <div className="mt-4 grid gap-4">
            <p className="text-sm text-ink-muted">{t('manual_text')}</p>
            <div>
              <ReportDialog row={row} />
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
