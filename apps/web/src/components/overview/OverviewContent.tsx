import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import { CaseDataTable } from '@/components/overview/CaseDataTable';
import { PersonOverview } from '@/components/overview/PersonOverview';
import { StatCard } from '@/components/overview/StatCard';
import { Button } from '@/components/ui/button';
import { loadCounselOverview } from '@/libs/cases/Overview';
import { Link } from '@/libs/I18nNavigation';
import type { AccountType } from '@/utils/accounts/Account';

/**
 * The overview: what needs the person's attention today. Lawyers, researchers and analysts get headline numbers, the cases that
 * need them and recent activity; a victim gets the progress of their claim.
 * @param props - The content props.
 * @param props.accountType - The signed-in person's account type: a person sees their claim, counsel see the case bank numbers.
 * @param props.userId - The Clerk user id, to find their claims or their cases.
 * @param props.firstName - Their first name, for the greeting.
 * @returns The overview page content.
 */
export async function OverviewContent(props: {
  accountType: AccountType;
  userId: string;
  firstName?: string | null;
}) {
  const t = await getTranslations('Overview');
  const overview =
    props.accountType === 'person' ? null : await loadCounselOverview({ userId: props.userId });

  return (
    <>
      <PageHeader
        title={props.firstName ? t('greeting', { name: props.firstName }) : t('greeting_anonymous')}
        description={props.accountType === 'person' ? t('subtitle_person') : t('subtitle')}
        actions={
          props.accountType === 'person' ? null : (
            <Button asChild size="lg">
              <Link href="/dashboard/cases">{t('primary_action')}</Link>
            </Button>
          )
        }
      />

      {overview ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('stat_new_cases')}
              value={String(overview.stats.newCases)}
              hint={t('stat_new_cases_hint', { count: overview.stats.newThisWeek })}
            />
            <StatCard
              label={t('stat_open_cases')}
              value={String(overview.stats.openCases)}
              hint={t('stat_open_cases_hint', { count: overview.stats.takenThisMonth })}
            />
            <StatCard
              label={t('stat_claimants')}
              value={String(overview.stats.waitingClaimants)}
              hint={t('stat_claimants_hint', { count: overview.stats.acrossCases })}
            />
            <StatCard
              label={t('stat_sealed')}
              value={String(overview.stats.sealedFiles)}
              hint={t('stat_sealed_hint', { count: overview.stats.sealedThisMonth })}
            />
          </div>

          <PageSection
            title={t('attention_title')}
            description={t('attention_description')}
            action={
              <Link
                href="/dashboard/cases"
                className="text-sm font-medium text-ink underline underline-offset-4 focus-ring hover:text-ink-muted"
              >
                {t('view_all')}
              </Link>
            }
          >
            <CaseDataTable cases={overview.attention} variant="compact" />
          </PageSection>
        </div>
      ) : (
        <PersonOverview userId={props.userId} />
      )}
    </>
  );
}
