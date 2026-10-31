import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { ActionsTable } from '@/components/cases/ActionsTable';
import { OperatorsTable } from '@/components/cases/OperatorsTable';
import { ResearchTable } from '@/components/cases/ResearchTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionForm } from '@/components/staff/ActionForm';
import { AddDialog } from '@/components/staff/AddDialog';
import { StatementForm } from '@/components/staff/AnalysisParts';
import { CaseStage } from '@/components/staff/CaseStage';
import { CaseSteps } from '@/components/staff/CaseSteps';
import { EvidenceForm } from '@/components/staff/EvidenceForm';
import { EvidenceTable } from '@/components/staff/EvidenceTable';
import { ListPanel } from '@/components/staff/ListPanel';
import { OperatorForm } from '@/components/staff/OperatorForm';
import { QuickAdd } from '@/components/staff/QuickAdd';
import { ReportDialog } from '@/components/staff/ReportDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireStaff } from '@/libs/accounts/Staff';
import { listEvidence } from '@/libs/analysis/Evidence';
import { listResearch } from '@/libs/analysis/Research';
import { listActions } from '@/libs/cases/Actions';
import { getCase, toCaseRow } from '@/libs/cases/Cases';
import { Link } from '@/libs/I18nNavigation';
import { analysisStatus } from '@/utils/analysis/Status';
import { actionRows } from '@/utils/cases/Actions';
import { researchRows } from '@/utils/cases/ResearchRows';

type StaffCasePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: StaffCasePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return { title: t('case_page_title') };
}

export default async function StaffCasePage(props: StaffCasePageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  await requireStaff();
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  const research = await listResearch(found.id, { inReview: true });
  const status = analysisStatus({
    planned: research.filter((item) => item.plan).length,
    reported: research.filter((item) => item.report).length,
  });
  const rows = researchRows(
    research,
    (item) => `/dashboard/staff/cases/${found.id}/research/${item.statementId}`,
  );
  const evidence = await listEvidence(found.id);
  const offChain = evidence.filter((item) => item.source === 'off_chain');
  const actions = actionRows(await listActions(found.id), evidence);
  const statements = research.map((item) => ({ id: item.statement.id, text: item.statement.text }));
  const actionOptions = actions.map((action) => ({ id: action.id, title: action.title }));
  const row = toCaseRow(found);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href="/dashboard/staff/cases">
          <ArrowLeftIcon aria-hidden="true" />
          {t('analysis_back')}
        </Link>
      </Button>
      <PageHeader
        title={found.name}
        description={
          <span>
            <span className="font-mono">{found.number}</span> ·{' '}
            {t('case_facts', { victims: found.claimants, jurisdictions: found.jurisdictions })}
          </span>
        }
      />
      <div className="grid gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-muted">{t('case_stage_label')}</span>
          <CaseStage id={found.id} status={found.status} hasReport={found.hasReport} />
        </div>

        <Tabs defaultValue="actions">
          <TabsList aria-label={t('lists_label')}>
            <TabsTrigger value="actions">
              {t('tab_actions')} <Badge variant="muted">{actions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="research">
              {t('tab_research')} <Badge variant="muted">{rows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="offchain">
              {t('tab_offchain')} <Badge variant="muted">{offChain.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="evidence">
              {t('tab_evidence')} <Badge variant="muted">{evidence.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="people">
              {t('tab_people')} <Badge variant="muted">{found.operators.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions">
            <ListPanel
              description={t('actions_section_text')}
              action={
                <AddDialog
                  label={t('actions_open')}
                  title={t('actions_add_title')}
                  description={t('actions_add_text')}
                >
                  <ActionForm caseId={found.id} />
                </AddDialog>
              }
            >
              <QuickAdd caseId={found.id} list="action" />
              {actions.length > 0 ? (
                <ActionsTable actions={actions} caseId={found.id} />
              ) : (
                <p className="text-sm text-ink-muted">{t('actions_empty')}</p>
              )}
            </ListPanel>
          </TabsContent>

          <TabsContent value="research">
            <div className="grid gap-8 pt-4">
              <CaseSteps status={status} />
              <ListPanel
                description={t('research_text')}
                action={
                  <AddDialog
                    label={t('statements_open')}
                    title={t('statements_title')}
                    description={t('statements_text')}
                  >
                    <StatementForm caseId={found.id} />
                  </AddDialog>
                }
              >
                {rows.length > 0 ? (
                  <ResearchTable rows={rows} caseId={found.id} />
                ) : (
                  <p className="text-sm text-ink-muted">{t('statements_empty')}</p>
                )}
              </ListPanel>
            </div>
          </TabsContent>

          <TabsContent value="offchain">
            <ListPanel
              description={t('offchain_text')}
              action={
                <AddDialog
                  label={t('evidence_open')}
                  title={t('evidence_off_chain_title')}
                  description={t('evidence_off_chain_text')}
                >
                  <EvidenceForm
                    caseId={found.id}
                    source="off_chain"
                    statements={statements}
                    actions={actionOptions}
                  />
                </AddDialog>
              }
            >
              {offChain.length > 0 ? (
                <EvidenceTable
                  caseId={found.id}
                  items={offChain}
                  statements={statements}
                  actions={actionOptions}
                />
              ) : (
                <p className="text-sm text-ink-muted">{t('evidence_empty')}</p>
              )}
            </ListPanel>
          </TabsContent>

          <TabsContent value="evidence">
            <ListPanel
              description={t('evidence_text')}
              action={
                <AddDialog
                  label={t('evidence_open')}
                  title={t('evidence_title')}
                  description={t('evidence_text')}
                >
                  <EvidenceForm caseId={found.id} statements={statements} actions={actionOptions} />
                </AddDialog>
              }
            >
              {evidence.length > 0 ? (
                <EvidenceTable
                  caseId={found.id}
                  items={evidence}
                  statements={statements}
                  actions={actionOptions}
                />
              ) : (
                <p className="text-sm text-ink-muted">{t('evidence_empty')}</p>
              )}
            </ListPanel>
          </TabsContent>

          <TabsContent value="people">
            <ListPanel
              description={t('operators_section_text')}
              action={
                <AddDialog
                  label={t('operators_open')}
                  title={t('operators_title')}
                  description={t('operators_text')}
                >
                  <OperatorForm caseId={found.id} />
                </AddDialog>
              }
            >
              <QuickAdd caseId={found.id} list="actor" />
              {found.operators.length > 0 ? (
                <OperatorsTable operators={found.operators} caseId={found.id} />
              ) : (
                <p className="text-sm text-ink-muted">{t('operators_empty')}</p>
              )}
            </ListPanel>
          </TabsContent>
        </Tabs>

        <details className="border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">{t('manual_title')}</summary>
          <div className="mt-4 grid gap-4">
            <p className="text-sm text-ink-muted">{t('manual_text')}</p>
            <div>
              <ReportDialog row={row} />
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
