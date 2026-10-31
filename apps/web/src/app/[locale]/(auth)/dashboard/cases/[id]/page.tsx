import { currentUser } from '@clerk/nextjs/server';
import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { AffectedJurisdictions } from '@/components/cases/AffectedJurisdictions';
import { CaseActions } from '@/components/cases/CaseActions';
import { CaseClaimantsTable } from '@/components/cases/CaseClaimantsTable';
import { CaseEvidence } from '@/components/cases/CaseEvidence';
import { ContactClaimantsBox } from '@/components/cases/CaseLocked';
import { CaseOperators } from '@/components/cases/CaseOperators';
import { CaseStory } from '@/components/cases/CaseStory';
import { ReportFigures } from '@/components/cases/ReportSummary';
import { ResearchTable } from '@/components/cases/ResearchTable';
import { TakeCaseDialog } from '@/components/cases/TakeCaseDialog';
import { ViewAllLink } from '@/components/cases/ViewAllLink';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import { StatCard } from '@/components/overview/StatCard';
import { Button } from '@/components/ui/button';
import { readCaseAccess } from '@/libs/accounts/CaseAccess';
import { listEvidence } from '@/libs/analysis/Evidence';
import { listResearch } from '@/libs/analysis/Research';
import { listActions } from '@/libs/cases/Actions';
import { canViewCaseClaims } from '@/libs/cases/CaseClaims';
import { evaluateTake, getCase } from '@/libs/cases/Cases';
import type { CaseDetail } from '@/libs/cases/Cases';
import { readCaseStory } from '@/libs/cases/CaseStory';
import { loadClaimantRows } from '@/libs/cases/ClaimantRows';
import { getReport } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';
import { parseAccount } from '@/utils/accounts/Account';
import { parseProfile } from '@/utils/accounts/Profile';
import { actionRows } from '@/utils/cases/Actions';
import { previewRows } from '@/utils/cases/Preview';
import { researchRows } from '@/utils/cases/ResearchRows';

type CasePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: CasePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'CaseDetail' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

/**
 * What this viewer may do with this case: whether a lawyer's firm could take it now (and if not, why), whether they lead it, and
 * whether they may read its claims. Claimants are shown to Celia staff and the firm that leads the case, never to anyone else.
 * @param found - The case.
 * @param user - The signed-in person.
 * @returns The decision for a lawyer, and whether claims are visible.
 */
async function loadViewer(found: CaseDetail, user: Awaited<ReturnType<typeof currentUser>>) {
  const account = parseAccount(user?.publicMetadata);
  const profile = parseProfile('counsel', user?.privateMetadata);
  const counsel =
    user && account?.accountType === 'counsel' && profile?.accountType === 'counsel'
      ? { id: user.id, verified: account.review === 'verified' }
      : undefined;

  // Ask as if the lawyer had confirmed conflicts: that is the one thing they do in the dialog, so what is left is why not.
  const decision = counsel
    ? await evaluateTake({
        userId: counsel.id,
        verified: counsel.verified,
        found,
        conflictsConfirmed: true,
      })
    : undefined;
  const canSeeClaims = user
    ? await canViewCaseClaims({ userId: user.id, staff: account?.staff === true }, found.id)
    : false;

  return { decision, canSeeClaims };
}

export default async function CasePage(props: CasePageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'CaseDetail' });
  const format = await getFormatter({ locale });
  const found = z.uuid().safeParse(id).success ? await getCase(id) : undefined;

  if (!found) {
    notFound();
  }

  const user = await currentUser();
  const access = await readCaseAccess();
  const { decision, canSeeClaims } = await loadViewer(found, user);
  const [report, research, story, alleged, evidence] = await Promise.all([
    found.hasReport ? getReport(found.id) : null,
    listResearch(found.id),
    readCaseStory(found.id, access),
    listActions(found.id),
    listEvidence(found.id),
  ]);
  const actions = actionRows(alleged, evidence);
  const rows = researchRows(research, (item) =>
    item.state === 'reported' && item.run !== null
      ? `/dashboard/cases/${found.id}/analysis/${item.run}`
      : null,
  );

  const claimants = canSeeClaims
    ? await loadClaimantRows(found.id, (number) => t('claimant_number', { number }))
    : [];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href="/dashboard/cases">
          <ArrowLeftIcon aria-hidden="true" />
          {t('back')}
        </Link>
      </Button>
      <PageHeader
        title={
          <>
            <span className="[-webkit-text-stroke:0.04em_currentColor]">{found.name}</span>{' '}
            <span className="text-ink-muted">({found.number})</span>
          </>
        }
        actions={decision?.ok ? <TakeCaseDialog caseId={found.id} /> : null}
      />
      {/* Aeonik has only regular and bold, so a thin outline gives the section titles a weight in between. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 [&_h2]:[-webkit-text-stroke:0.035em_currentColor] [&>*+*]:border-t [&>*+*]:border-border [&>*+*]:pt-12">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              size="sm"
              label={t('stat_jurisdictions')}
              value={format.number(found.jurisdictions)}
            />
            {canSeeClaims ? (
              <a href="#claimants" className="focus-ring hover:opacity-80">
                <StatCard
                  size="sm"
                  label={t('stat_claimants')}
                  value={format.number(found.claimants)}
                />
              </a>
            ) : (
              <StatCard
                size="sm"
                label={t('stat_claimants')}
                value={format.number(found.claimants)}
              />
            )}
            <StatCard
              size="sm"
              label={t('stat_confirmed')}
              value={format.number(found.confirmed)}
            />
            <StatCard
              size="sm"
              label={t('stat_updated')}
              value={format.dateTime(new Date(found.updatedAt), { dateStyle: 'medium' })}
            />
          </div>
          {report && <ReportFigures figures={report.snapshot.figures} />}
        </div>
        <AffectedJurisdictions caseId={found.id} />
        <CaseStory story={story} />
        <CaseActions access={access} caseId={found.id} actions={actions} />
        <CaseEvidence access={access} caseId={found.id} items={evidence} />
        <CaseOperators access={access} caseId={found.id} operators={found.operators} />
        <PageSection
          title={t('report_title')}
          action={
            rows.length > previewRows && (
              <ViewAllLink
                href={`/dashboard/cases/${found.id}/analysis`}
                count={rows.length}
                access={access}
              />
            )
          }
        >
          {rows.length > 0 ? (
            <div className="grid gap-4">
              <p className="max-w-prose text-sm text-ink-muted">{t('reports_intro')}</p>
              <ResearchTable rows={rows.slice(0, previewRows)} preview />
            </div>
          ) : (
            <p className="text-ink-muted">{t('report_none')}</p>
          )}
        </PageSection>
        {canSeeClaims && (
          <div id="claimants" className="scroll-mt-24">
            <PageSection
              title={t('claimants_title')}
              description={t('claimants_description')}
              action={
                claimants.length > previewRows && (
                  <ViewAllLink
                    href={`/dashboard/cases/${found.id}/claimants`}
                    count={claimants.length}
                    access="full"
                  />
                )
              }
            >
              <CaseClaimantsTable claims={claimants.slice(0, previewRows)} preview />
            </PageSection>
          </div>
        )}
        {(access !== 'full' || decision) && (
          <ContactClaimantsBox access={access} caseId={found.id} />
        )}
      </div>
    </>
  );
}
