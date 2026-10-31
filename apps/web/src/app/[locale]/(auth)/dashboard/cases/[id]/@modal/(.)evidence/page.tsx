import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EvidenceBody } from '@/components/cases/lists/CaseListBodies';
import { CaseListModal } from '@/components/cases/lists/CaseListModal';

type EvidenceModalProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EvidenceModal(props: EvidenceModalProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CaseDetail');

  return (
    <CaseListModal title={t('evidence_title')} description={t('evidence_description')}>
      <EvidenceBody caseId={id} />
    </CaseListModal>
  );
}
