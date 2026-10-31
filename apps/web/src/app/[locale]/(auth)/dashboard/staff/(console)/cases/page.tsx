import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { CaseAdmin } from '@/components/staff/CaseAdmin';
import { requireStaff } from '@/libs/accounts/Staff';
import { listAnalysisStatuses } from '@/libs/analysis/Status';
import { listCases } from '@/libs/cases/Cases';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return {
    title: t('cases_title'),
  };
}

export default async function StaffCasesPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const [cases, statuses] = await Promise.all([listCases(), listAnalysisStatuses()]);

  return (
    <>
      <PageHeader title={t('cases_title')} description={t('cases_description')} />
      <CaseAdmin
        cases={cases.map((row) => ({ ...row, analysis: statuses.get(row.id) ?? 'needs_plan' }))}
      />
    </>
  );
}
