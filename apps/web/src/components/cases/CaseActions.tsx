import { getTranslations } from 'next-intl/server';
import { ActionsTable } from '@/components/cases/ActionsTable';
import { ViewAllLink } from '@/components/cases/ViewAllLink';
import { PageSection } from '@/components/layout/PageSection';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';
import type { ActionRow } from '@/utils/cases/Actions';
import { previewRows } from '@/utils/cases/Preview';

/**
 * What the claimants allege was done, for the lawyers and investigators reading the case: the first rows, with the evidence
 * attached to each action on and off the chain, and a way to open the page that lists them all. They are allegations and findings
 * of nothing, and the section says so.
 * @param props - The section props.
 * @param props.access - How much of the case the reader may see.
 * @param props.caseId - The case id, for the page with every action.
 * @param props.actions - The alleged actions with their evidence counts.
 * @returns The section, or nothing when staff have not added any.
 */
export async function CaseActions(props: {
  access: CaseAccess;
  caseId: string;
  actions: ActionRow[];
}) {
  const t = await getTranslations('CaseDetail');

  if (props.actions.length === 0) {
    return null;
  }

  return (
    <PageSection
      title={t('actions_title')}
      description={t('actions_description')}
      action={
        props.actions.length > previewRows && (
          <ViewAllLink
            href={`/dashboard/cases/${props.caseId}/actions`}
            count={props.actions.length}
            access={props.access}
          />
        )
      }
    >
      <ActionsTable actions={props.actions.slice(0, previewRows)} preview />
    </PageSection>
  );
}
