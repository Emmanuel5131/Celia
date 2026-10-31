import { getTranslations } from 'next-intl/server';
import { OperatorsTable } from '@/components/cases/OperatorsTable';
import { ViewAllLink } from '@/components/cases/ViewAllLink';
import { PageSection } from '@/components/layout/PageSection';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';
import type { CaseOperator } from '@/utils/cases/Operators';
import { previewRows } from '@/utils/cases/Preview';

/**
 * Who the claimants allege is behind the platform, as staff recorded it, for the lawyers and investigators reading the case: the
 * first rows, and a way to open the page that lists them all. They are allegations and findings of nothing, and the section says so.
 * @param props - The section props.
 * @param props.access - How much of the case the reader may see.
 * @param props.caseId - The case id, for the page with every person and group.
 * @param props.operators - The people and groups.
 * @returns The section, or nothing when staff have not added any.
 */
export async function CaseOperators(props: {
  access: CaseAccess;
  caseId: string;
  operators: CaseOperator[];
}) {
  const t = await getTranslations('CaseDetail');

  if (props.operators.length === 0) {
    return null;
  }

  return (
    <PageSection
      title={t('operators_title')}
      description={t('operators_description')}
      action={
        props.operators.length > previewRows && (
          <ViewAllLink
            href={`/dashboard/cases/${props.caseId}/operators`}
            count={props.operators.length}
            access={props.access}
          />
        )
      }
    >
      <OperatorsTable operators={props.operators.slice(0, previewRows)} preview />
    </PageSection>
  );
}
