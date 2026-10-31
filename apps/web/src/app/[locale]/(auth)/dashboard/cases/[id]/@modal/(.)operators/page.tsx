import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OperatorsBody } from '@/components/cases/lists/CaseListBodies';
import { CaseListModal } from '@/components/cases/lists/CaseListModal';

type OperatorsModalProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function OperatorsModal(props: OperatorsModalProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CaseDetail');

  return (
    <CaseListModal title={t('operators_title')} description={t('operators_description')}>
      <OperatorsBody caseId={id} />
    </CaseListModal>
  );
}
