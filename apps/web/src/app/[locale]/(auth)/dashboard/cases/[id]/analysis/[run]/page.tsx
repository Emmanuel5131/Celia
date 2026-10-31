import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { LockedList } from '@/components/cases/CaseLocked';
import { ReportNotebookButton } from '@/components/cases/ReportNotebookButton';
import { ReportPdfButton } from '@/components/cases/ReportPdfButton';
import { ReportSummary } from '@/components/cases/ReportSummary';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import { Button } from '@/components/ui/button';
import { readCaseAccess } from '@/libs/accounts/CaseAccess';
import { canOpenReport, getAnalysisByRun } from '@/libs/analysis/Research';
import { getCase } from '@/libs/cases/Cases';
import { getReport, listReportVersions } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';

type AnalysisPageProps = {
  params: Promise<{ locale: string; id: string; run: string }>;
  searchParams: Promise<{ version?: string }>;
};

export async function generateMetadata(props: AnalysisPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Analysis' });

  return { title: t('meta_title'), description: t('meta_description') };
}

export default async function AnalysisPage(props: AnalysisPageProps) {
  const { locale, id, run } = await props.params;
  const { version } = await props.searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Analysis' });
  const format = await getFormatter({ locale });
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  const asRun = z.coerce.number().int().positive().safeParse(run);
  const access = await readCaseAccess();

  // A reader who may only see the first rows of the research may only open the reports in those rows.
  if (
    access !== 'full' &&
    !(asRun.success && (await canOpenReport(found.id, asRun.data, access)))
  ) {
    return <LockedList reason={access} caseHref={`/dashboard/cases/${found.id}`} />;
  }

  const asked = z.coerce.number().int().positive().safeParse(version);
  const analysis = asRun.success ? await getAnalysisByRun(found.id, asRun.data) : null;
  const [report, versions] = analysis
    ? await Promise.all([
        getReport(found.id, {
          run: analysis.plan.run,
          version: asked.success ? asked.data : undefined,
        }),
        listReportVersions(found.id, analysis.plan.run),
      ])
    : [null, []];

  if (!analysis || !report) {
    notFound();
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href={`/dashboard/cases/${found.id}/analysis`}>
          <ArrowLeftIcon aria-hidden="true" />
          {t('back_to_list', { name: found.name })}
        </Link>
      </Button>
      <PageHeader
        title={analysis.statement.text}
        description={
          <span>
            {found.name} · <span className="font-mono">{found.number}</span> ·{' '}
            {t('run_label', { run: report.run })}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReportNotebookButton report={report} />
            <ReportPdfButton caseId={found.id} run={report.run} version={report.version} />
          </div>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
        <ReportSummary report={report} />
        {versions.length > 1 && (
          <PageSection title={t('versions_title')} description={t('versions_description')}>
            <ul className="grid gap-2">
              {versions.map((item) => (
                <li key={item.version} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {item.version === report.version ? (
                    <span className="font-medium">
                      {t('version_current', { version: item.version })}
                    </span>
                  ) : (
                    <Link
                      href={`/dashboard/cases/${found.id}/analysis/${report.run}?version=${item.version}`}
                      className="font-medium underline underline-offset-4 focus-ring hover:text-ink-muted"
                    >
                      {t('version_link', { version: item.version })}
                    </Link>
                  )}
                  <span className="text-sm text-ink-muted">
                    {format.dateTime(new Date(item.savedAt), { dateStyle: 'medium' })}
                  </span>
                  <span className="font-mono text-xs break-all text-ink-muted">{item.hash}</span>
                </li>
              ))}
            </ul>
          </PageSection>
        )}
      </div>
    </>
  );
}
