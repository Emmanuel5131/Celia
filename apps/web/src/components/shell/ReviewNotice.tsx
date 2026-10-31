import { InfoIcon } from '@phosphor-icons/react/ssr';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/libs/I18nNavigation';
import { cn } from '@/utils/Cn';

/**
 * Shown to an applicant whose application is not approved yet. While it is reviewed it says what is locked, when we received it
 * and when we aim to decide. A rejected application shows the outcome, the reason given and an Apply again button that opens once
 * the waiting period has passed, in a second half beside it, with the date it opens on under the reason. The message is clamped to two lines.
 * @param props - The notice props.
 * @param props.application - Where the application stands, when there is one on record.
 * @returns The notice.
 */
export async function ReviewNotice(props: {
  application?: {
    status: string;
    submittedAt: Date;
    reviewDueAt: Date;
    overdue: boolean;
    decisionNote: string | null;
    canReapply: boolean;
    reapplyOn: Date | null;
  };
}) {
  const t = await getTranslations('AppShell');
  const format = await getFormatter();
  const { application } = props;
  const day = (date: Date) => format.dateTime(date, { dateStyle: 'medium' });
  const rejected = application?.status === 'rejected';

  return (
    <Card
      variant="outline"
      size="sm"
      className={cn('mb-8', rejected && 'data-[variant=outline]:border-seal')}
    >
      <CardContent>
        <output className="flex items-start gap-4 text-sm">
          <InfoIcon
            className={cn('mt-0.5 size-4 shrink-0', rejected ? 'text-seal' : 'text-ink-muted')}
            aria-hidden="true"
          />
          {rejected ? (
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 sm:items-center sm:gap-4">
              <div className="grid min-w-0 gap-0.5">
                <p className="line-clamp-2" title={application.decisionNote ?? undefined}>
                  <span className="font-medium text-seal">{t('review_rejected_title')}</span>
                  {application.decisionNote && (
                    <span className="text-ink-muted">
                      {' '}
                      {t('review_rejected_reason', { note: application.decisionNote })}
                    </span>
                  )}
                </p>
                {!application.canReapply && application.reapplyOn && (
                  <p className="truncate text-xs text-ink-muted">
                    {t('review_reapply_on', { date: day(application.reapplyOn) })}
                  </p>
                )}
              </div>
              <div className="flex sm:justify-end">
                {application.canReapply ? (
                  <Button asChild size="sm">
                    <Link href="/dashboard/apply-again">{t('review_reapply_action')}</Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    {t('review_reapply_action')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-1">
              <p>{t('review_pending')}</p>
              {application?.status === 'in_review' && (
                <p className="text-ink-muted">
                  {application.overdue
                    ? t('review_overdue')
                    : t('review_due', {
                        submitted: day(application.submittedAt),
                        due: day(application.reviewDueAt),
                      })}
                </p>
              )}
            </div>
          )}
        </output>
      </CardContent>
    </Card>
  );
}
