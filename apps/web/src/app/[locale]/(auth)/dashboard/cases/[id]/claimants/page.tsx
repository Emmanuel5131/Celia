import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { ClaimantsBody } from '@/components/cases/lists/CaseListBodies';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { getCase } from '@/libs/cases/Cases';
import { Link } from '@/libs/I18nNavigation';

type CaseClaimantsPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: CaseClaimantsPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'CaseDetail' });

  return { title: t('claimants_title'), description: t('claimants_description') };
}

export default async function CaseClaimantsPage(props: CaseClaimantsPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'CaseDetail' });
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href={`/dashboard/cases/${found.id}`}>
          <ArrowLeftIcon aria-hidden="true" />
          {t('back_to_case', { name: found.name })}
        </Link>
      </Button>
      <PageHeader
        title={t('claimants_title')}
        description={
          <span>
            {found.name} · <span className="font-mono">{found.number}</span>
          </span>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <p className="max-w-prose text-ink-muted">{t('claimants_description')}</p>
        <ClaimantsBody caseId={found.id} />
      </div>
    </>
  );
}
