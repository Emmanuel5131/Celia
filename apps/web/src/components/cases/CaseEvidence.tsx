import { getTranslations } from 'next-intl/server';
import { ViewAllLink } from '@/components/cases/ViewAllLink';
import { PageSection } from '@/components/layout/PageSection';
import { EvidenceTable } from '@/components/staff/EvidenceTable';
import type { CaseEvidence as Evidence } from '@/libs/analysis/Evidence';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';
import { previewRows } from '@/utils/cases/Preview';

/**
 * The evidence a case rests on, for the lawyers and investigators reading it: the first rows, off chain (videos, pictures,
 * documents, links) and on chain (wallets, transactions, notebooks, chats, scripts), and a way to open the page that lists them all.
 * @param props - The section props.
 * @param props.access - How much of the case the reader may see.
 * @param props.caseId - The case id, for the page with all the evidence.
 * @param props.items - The evidence.
 * @returns The section, or nothing when staff have not added any.
 */
export async function CaseEvidence(props: {
  access: CaseAccess;
  caseId: string;
  items: Evidence[];
}) {
  const t = await getTranslations('CaseDetail');

  if (props.items.length === 0) {
    return null;
  }

  return (
    <PageSection
      title={t('evidence_title')}
      description={t('evidence_description')}
      action={
        props.items.length > previewRows && (
          <ViewAllLink
            href={`/dashboard/cases/${props.caseId}/evidence`}
            count={props.items.length}
            access={props.access}
          />
        )
      }
    >
      <EvidenceTable items={props.items.slice(0, previewRows)} preview />
    </PageSection>
  );
}
