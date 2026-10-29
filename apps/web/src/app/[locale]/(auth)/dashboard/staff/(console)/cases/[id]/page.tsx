import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { CheckTable } from '@/components/cases/CheckTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/libs/accounts/Staff';
import { getCase } from '@/libs/cases/Cases';
import { getReport } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';
import { checkRows } from '@/utils/cases/ReportChecks';

type StaffCaseAnalysisPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: StaffCaseAnalysisPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return { title: t('analysis_title') };
}

export default async function StaffCaseAnalysisPage(props: StaffCaseAnalysisPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  const report = found.hasReport ? await getReport(found.id) : null;
  const analysis = `/dashboard/cases/${found.id}/analysis`;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href="/dashboard/staff/cases">
          <ArrowLeftIcon aria-hidden="true" />
          {t('analysis_back')}
        </Link>
      </Button>
      <PageHeader
        title={t('analysis_title')}
        description={
          <span>
            {found.name} · <span className="font-mono">{found.number}</span>
          </span>
        }
        actions={
          report ? (
            <Button asChild variant="outline">
              <Link href={`${analysis}?version=${report.version}`}>{t('analysis_open')}</Link>
            </Button>
          ) : null
        }
      />
      {report ? (
        <div className="grid gap-4">
          <p className="text-sm text-ink-muted">
            {t('analysis_summary', {
              checks: report.snapshot.checks.length,
              notebooks: report.snapshot.tests.length,
            })}
          </p>
          <CheckTable
            rows={checkRows(
              report.snapshot,
              (testId) => `${analysis}?version=${report.version}#test-${testId}`,
            )}
            searchPlaceholder={t('analysis_search')}
          />
        </div>
      ) : (
        <p className="text-ink-muted">{t('analysis_no_report')}</p>
      )}
    </>
  );
}
