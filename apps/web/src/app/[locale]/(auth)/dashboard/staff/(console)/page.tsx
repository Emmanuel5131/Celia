import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import { StaffNextUpTable } from '@/components/staff/StaffNextUpTable';
import { StaffOverviewCards } from '@/components/staff/StaffOverviewCards';
import { requireStaff } from '@/libs/accounts/Staff';
import { staffCounts, staffNextUp } from '@/libs/accounts/StaffCounts';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return {
    title: t('meta_title'),
  };
}

export default async function StaffOverviewPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  // Hiding a link is not access control: every staff page checks for itself, and anyone else gets a 404.
  await requireStaff();
  const t = await getTranslations({ locale, namespace: 'Staff' });
  const [counts, nextUp] = await Promise.all([staffCounts(), staffNextUp()]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
        <StaffOverviewCards counts={counts} oldest={nextUp.oldest} />
        <PageSection title={t('next_title')} description={t('next_description')}>
          <StaffNextUpTable items={nextUp.items} />
        </PageSection>
      </div>
    </>
  );
}
