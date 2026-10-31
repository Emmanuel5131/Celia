import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactRequestsTable } from '@/components/staff/ContactRequestsTable';
import { requireStaff } from '@/libs/accounts/Staff';
import { listForStaff } from '@/libs/contact/ContactRequests';

type PageProps = {
  params: Promise<{ locale: string }>;
};

const open = (status: string) => status === 'submitted' || status === 'agent_reviewed';

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return {
    title: t('cr_title'),
  };
}

export default async function StaffContactRequestsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const items = await listForStaff();
  // Those waiting for a decision come first, oldest first; the decided ones follow, newest first.
  const waiting = items.filter((item) => open(item.status)).toReversed();
  const decided = items.filter((item) => !open(item.status));

  return (
    <>
      <PageHeader title={t('cr_title')} description={t('cr_description')} />
      <ContactRequestsTable items={[...waiting, ...decided]} />
    </>
  );
}
