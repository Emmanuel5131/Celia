import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReportsBody } from '@/components/cases/lists/CaseListBodies';
import { CaseListModal } from '@/components/cases/lists/CaseListModal';

type ReportsModalProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ReportsModal(props: ReportsModalProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('Analysis');

  return (
    <CaseListModal title={t('list_title')} description={t('list_meta_description')}>
      <ReportsBody caseId={id} />
    </CaseListModal>
  );
}
