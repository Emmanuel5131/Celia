import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClaimantsBody } from '@/components/cases/lists/CaseListBodies';
import { CaseListModal } from '@/components/cases/lists/CaseListModal';

type ClaimantsModalProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ClaimantsModal(props: ClaimantsModalProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CaseDetail');

  return (
    <CaseListModal title={t('claimants_title')} description={t('claimants_description')}>
      <ClaimantsBody caseId={id} />
    </CaseListModal>
  );
}
