import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import type { readFollowUp } from '@/libs/claims/FollowUp';

type FollowUp = NonNullable<Awaited<ReturnType<typeof readFollowUp>>>;

/**
 * How the claimant asked to be followed up, for staff who need to reach them. It is private to the claimant and staff: nothing
 * here goes to a lawyer or organisation unless the claimant explicitly agrees.
 * @param props - The card props.
 * @param props.followUp - What the claimant gave.
 * @returns The card.
 */
export async function ClaimFollowUp(props: { followUp: FollowUp }) {
  const t = await getTranslations('StaffClaims');
  const { followUp } = props;
  const facts = [
    [t('followup_channel'), t(`followup_channel_${followUp.channel}`)],
    [t('followup_value'), followUp.value],
    [t('followup_time'), followUp.bestTime],
  ] as const;

  return (
    <Card variant="outline" className="mt-8">
      <CardContent className="grid gap-4">
        <h2 className="text-base font-medium">{t('followup_title')}</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="grid gap-1">
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="text-sm break-words">{value}</dd>
              </div>
            ))}
        </dl>
        <CardDescription>{t('followup_private')}</CardDescription>
      </CardContent>
    </Card>
  );
}
