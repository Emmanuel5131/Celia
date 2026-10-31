import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { ApplicationsTable } from '@/components/staff/ApplicationsTable';
import { listApplications } from '@/libs/accounts/Applications';
import { requireStaff } from '@/libs/accounts/Staff';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return {
    title: t('queue_title'),
  };
}

export default async function StaffApplicationsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();

  return (
    <>
      <PageHeader title={t('queue_title')} description={t('queue_description')} />
      <ApplicationsTable items={await listApplications()} />
    </>
  );
}
