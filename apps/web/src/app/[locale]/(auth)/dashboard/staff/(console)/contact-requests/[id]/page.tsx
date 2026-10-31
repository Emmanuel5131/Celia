import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactRequestReview } from '@/components/staff/ContactRequestReview';
import { ContactRequestStatusBadge } from '@/components/staff/ContactRequestStatusBadge';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/libs/accounts/Staff';
import { getForStaff } from '@/libs/contact/ContactRequests';
import { Link } from '@/libs/I18nNavigation';

type StaffContactRequestPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: StaffContactRequestPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return { title: t('cr_page_title') };
}

export default async function StaffContactRequestPage(props: StaffContactRequestPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const request = z.uuid().safeParse(id).success ? await getForStaff(id) : null;

  if (!request) {
    notFound();
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href="/dashboard/staff/contact-requests">
          <ArrowLeftIcon aria-hidden="true" />
          {t('cr_back')}
        </Link>
      </Button>
      <PageHeader
        title={request.organisation ?? t('cr_page_title')}
        description={t('cr_page_description')}
        actions={<ContactRequestStatusBadge status={request.status} />}
      />
      <ContactRequestReview request={request} />
    </>
  );
}
