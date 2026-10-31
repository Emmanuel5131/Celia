import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { ReportsBody } from '@/components/cases/lists/CaseListBodies';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { getCase } from '@/libs/cases/Cases';
import { Link } from '@/libs/I18nNavigation';

type AnalysisListPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: AnalysisListPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Analysis' });

  return { title: t('list_meta_title'), description: t('list_meta_description') };
}

export default async function AnalysisListPage(props: AnalysisListPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Analysis' });
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href={`/dashboard/cases/${found.id}`}>
          <ArrowLeftIcon aria-hidden="true" />
          {t('back', { name: found.name })}
        </Link>
      </Button>
      <PageHeader
        title={t('list_title')}
        description={
          <span>
            {found.name} · <span className="font-mono">{found.number}</span>
          </span>
        }
      />
      <ReportsBody caseId={found.id} />
    </>
  );
}
