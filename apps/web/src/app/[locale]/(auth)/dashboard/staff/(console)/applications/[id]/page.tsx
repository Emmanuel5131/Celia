import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ApplicationReview } from '@/components/staff/ApplicationReview';
import { ApplicationStatusBadge } from '@/components/staff/ApplicationStatusBadge';
import { Button } from '@/components/ui/button';
import { getApplicationDetail } from '@/libs/accounts/Applications';
import { requireStaff } from '@/libs/accounts/Staff';
import { Env } from '@/libs/Env';
import { Link } from '@/libs/I18nNavigation';

type StaffApplicationPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: StaffApplicationPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return { title: t('app_page_title') };
}

export default async function StaffApplicationPage(props: StaffApplicationPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  const staff = await requireStaff();
  const detail = await getApplicationDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href="/dashboard/staff/applications">
          <ArrowLeftIcon aria-hidden="true" />
          {t('app_back')}
        </Link>
      </Button>
      <PageHeader
        title={detail.item.organisation ?? t('app_independent')}
        description={t('app_page_description')}
        actions={<ApplicationStatusBadge status={detail.item.status} />}
      />
      <ApplicationReview
        detail={detail}
        actorId={staff.id}
        production={Env.NODE_ENV === 'production'}
      />
    </>
  );
}
