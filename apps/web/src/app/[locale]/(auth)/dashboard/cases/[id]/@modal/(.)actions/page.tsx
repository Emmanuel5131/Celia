import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActionsBody } from '@/components/cases/lists/CaseListBodies';
import { CaseListModal } from '@/components/cases/lists/CaseListModal';

type ActionsModalProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ActionsModal(props: ActionsModalProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CaseDetail');

  return (
    <CaseListModal title={t('actions_title')} description={t('actions_description')}>
      <ActionsBody caseId={id} />
    </CaseListModal>
  );
}
