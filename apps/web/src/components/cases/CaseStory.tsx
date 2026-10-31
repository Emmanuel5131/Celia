import { getFormatter, getTranslations } from 'next-intl/server';
import { ReportedPattern } from '@/components/cases/ReportedPattern';
import { PageSection } from '@/components/layout/PageSection';
import { StatCard } from '@/components/overview/StatCard';
import type { CaseStoryView } from '@/libs/cases/CaseStory';

/**
 * What may have happened, in short: what claimants report, how far it reaches in two figures, and where the platform's words and the
 * chain disagree. It reads the case's stored story, and closes with the note that none of this is a finding of fraud.
 * @param props - The section props.
 * @param props.story - The stored story of the case, cut to what the reader may see, or null when there is none.
 * @returns The section, or nothing when there is nothing to tell.
 */
export async function CaseStory(props: { story: CaseStoryView | null }) {
  const t = await getTranslations('CaseStory');
  const note = await getTranslations('ReportedPattern');
  const format = await getFormatter();
  const { story } = props;

  if (
    !story ||
    (!story.claimantsSay &&
      !story.reach &&
      story.platformSaidVersusChain.length === 0 &&
      !story.headline)
  ) {
    return null;
  }

  const { claimantsSay, reach } = story;
  // A count is formatted for the reader; a figure the report gave in words is shown as written.
  const wallets =
    reach && /^\d+$/u.test(reach.wallets) ? format.number(Number(reach.wallets)) : reach?.wallets;
  const told = claimantsSay !== null || reach !== null || story.platformSaidVersusChain.length > 0;

  return (
    <PageSection title={t('title')}>
      <div className="grid max-w-3xl gap-6">
        {told ? (
          <>
            {claimantsSay && (
              <ReportedPattern
                pattern={{
                  type: claimantsSay.kind,
                  count: claimantsSay.claimants,
                  total: claimantsSay.of,
                  confirmed: claimantsSay.confirmed,
                }}
                bare
              />
            )}
            {reach && wallets && (
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard size="sm" label={t('wallets_label')} value={wallets} />
                <StatCard size="sm" label={t('losses_label')} value={reach.estimatedLoss} />
              </div>
            )}
            {story.platformSaidVersusChain.map((item) => (
              <div key={item.platformSaid} className="grid gap-1 border-l border-border pl-4">
                <p className="text-sm text-ink-muted">{t('platform_label')}</p>
                <p>{item.platformSaid}</p>
                <p className="mt-2 text-sm text-ink-muted">{t('chain_label')}</p>
                <p>{item.chainShows}</p>
              </div>
            ))}
          </>
        ) : (
          <p>{story.headline}</p>
        )}
        <p className="text-sm text-ink-muted">{note('note')}</p>
      </div>
    </PageSection>
  );
}
