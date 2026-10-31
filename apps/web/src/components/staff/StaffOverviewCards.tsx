import {
  ArrowRightIcon,
  EnvelopeSimpleIcon,
  FilesIcon,
  IdentificationBadgeIcon,
  PaperPlaneTiltIcon,
} from '@phosphor-icons/react/ssr';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardValue,
} from '@/components/ui/card';
import type { StaffCounts } from '@/libs/accounts/StaffCounts';
import { Link } from '@/libs/I18nNavigation';
import { cn } from '@/utils/Cn';

const icons = {
  applications: IdentificationBadgeIcon,
  claims: FilesIcon,
  contact: PaperPlaneTiltIcon,
  mail: EnvelopeSimpleIcon,
} as const;

/**
 * What is waiting for staff, one card per queue, each linking to its page. It is the starting point: the number says how much,
 * the line under it how long the oldest has waited, and the whole card is the way in. A filled square marks a queue with
 * something in it and a hollow one an empty queue, so the state does not rest on colour.
 * @param props - The cards props.
 * @param props.counts - How much is waiting in each queue.
 * @param props.oldest - When the oldest item of each queue started waiting, as an ISO time, or null for an empty queue.
 * @returns The cards.
 */
export async function StaffOverviewCards(props: {
  counts: StaffCounts;
  oldest: Record<keyof StaffCounts, string | null>;
}) {
  const t = await getTranslations('Staff');
  const nav = await getTranslations('AppShell');
  const format = await getFormatter();
  const cards = [
    { id: 'applications', href: '/dashboard/staff/applications' },
    { id: 'claims', href: '/dashboard/staff/claims' },
    { id: 'contact', href: '/dashboard/staff/contact-requests' },
    { id: 'mail', href: '/dashboard/staff/mail' },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = icons[card.id];
        const value = props.counts[card.id];
        const oldest = props.oldest[card.id];

        return (
          <Link key={card.id} href={card.href} className="group/queue block focus-ring">
            <Card
              variant="outline"
              className="h-full transition-colors group-hover/queue:border-ink"
            >
              <CardHeader>
                <CardDescription className="flex items-center gap-2 text-ink">
                  <Icon aria-hidden="true" />
                  {nav(`nav_staff_${card.id}`)}
                </CardDescription>
                <CardAction>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="text-ink-muted transition-transform group-hover/queue:translate-x-1 group-hover/queue:text-ink"
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <CardValue>{format.number(value)}</CardValue>
                  <CardDescription>
                    {t(`overview_${card.id}_hint`, { count: value })}
                  </CardDescription>
                </div>
                <p className="flex items-center gap-2 border-t border-line-soft pt-4 text-sm text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 shrink-0 border border-ink', value > 0 && 'bg-ink')}
                  />
                  {oldest && value > 0
                    ? t('overview_oldest', { when: format.relativeTime(new Date(oldest)) })
                    : t('overview_clear')}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
