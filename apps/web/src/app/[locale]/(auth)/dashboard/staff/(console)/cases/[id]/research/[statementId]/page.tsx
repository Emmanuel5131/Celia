import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import {
  AgentSection,
  PlanSection,
  ReplanSection,
  ReportSection,
  ReviewSection,
} from '@/components/staff/CaseSections';
import { RemoveStatementButton } from '@/components/staff/RemoveStatementButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/libs/accounts/Staff';
import { previewBrief } from '@/libs/analysis/Analysis';
import { listResearch } from '@/libs/analysis/Research';
import { getCase } from '@/libs/cases/Cases';
import { Link } from '@/libs/I18nNavigation';

type ResearchPageProps = {
  params: Promise<{ locale: string; id: string; statementId: string }>;
};

/**
 * The part of a statement's page that depends on where its research stands: planning, waiting for the assistant, the report in
 * review, or the saved report.
 * @param props - The section props.
 * @param props.caseId - The case id.
 * @param props.number - The case number.
 * @param props.statementId - The statement id.
 * @param props.item - The statement with its research.
 * @param props.planData - What planning needs.
 * @returns The sections for the state.
 */
function ResearchSections(props: {
  caseId: string;
  number: string;
  statementId: string;
  item: Awaited<ReturnType<typeof listResearch>>[number];
  planData: React.ComponentProps<typeof PlanSection>['plan'];
}) {
  const t = useTranslations('Staff');
  const { state, plan, report } = props.item;

  return (
    <>
      {state === 'not_checkable' && (
        <PageSection title={t('research_not_checkable_title')}>
          <p className="max-w-prose text-sm text-ink-muted">{t('research_not_checkable_text')}</p>
        </PageSection>
      )}
      {state === 'not_researched' && <PlanSection plan={props.planData} />}
      {state === 'researching' && plan && (
        <AgentSection caseId={props.caseId} number={props.number} latest={plan} />
      )}
      {state === 'in_review' && report && (
        <ReviewSection caseId={props.caseId} number={props.number} report={report} />
      )}
      {state === 'reported' && report && <ReportSection caseId={props.caseId} report={report} />}
      {state === 'reported' && <ReplanSection plan={props.planData} />}
      {(state === 'not_researched' || state === 'not_checkable') && (
        <div>
          <RemoveStatementButton caseId={props.caseId} statementId={props.statementId} />
        </div>
      )}
    </>
  );
}

export async function generateMetadata(props: ResearchPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return { title: t('research_page_title') };
}

export default async function StaffResearchPage(props: ResearchPageProps) {
  const { locale, id, statementId } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const found =
    z.uuid().safeParse(id).success && z.uuid().safeParse(statementId).success
      ? await getCase(id)
      : undefined;

  if (!found) {
    notFound();
  }

  const research = await listResearch(found.id, { inReview: true });
  const item = research.find((entry) => entry.statement.id === statementId);

  if (!item) {
    notFound();
  }

  const { statement, state } = item;
  // A statement is planned the first time, or again once its report is saved; a plan waiting for its report is not planned twice.
  const prepared =
    state === 'not_researched' || state === 'reported'
      ? await previewBrief(found.id, statement.id)
      : null;
  const planData = {
    caseId: found.id,
    statementId: statement.id,
    problems: prepared?.problems ?? [],
    brief: prepared?.brief ?? null,
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href={`/dashboard/staff/cases/${found.id}`}>
          <ArrowLeftIcon aria-hidden="true" />
          {t('research_back', { name: found.name })}
        </Link>
      </Button>
      <PageHeader
        title={statement.text}
        description={
          <span>
            <span className="font-mono">{found.number}</span> · {found.name}
          </span>
        }
      />
      <div className="grid gap-8">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="muted">{t(`statements_kind_${statement.kind}`)}</Badge>
          <a
            href={statement.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm break-all text-ink-muted underline"
          >
            {t('statements_source')}
          </a>
        </div>

        <ResearchSections
          caseId={found.id}
          number={found.number}
          statementId={statement.id}
          item={item}
          planData={planData}
        />
      </div>
    </>
  );
}
