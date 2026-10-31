import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ApplicationStatus } from '@/utils/accounts/Institution';

const variants = { in_review: 'dashed', approved: 'solid', rejected: 'seal' } as const;

/**
 * Where an application stands, as a tag: dashed while it is in review, solid once approved, seal for a rejection.
 * @param props - The badge props.
 * @param props.status - The application's status.
 * @returns The tag.
 */
export function ApplicationStatusBadge(props: { status: ApplicationStatus }) {
  const t = useTranslations('Staff');

  return <Badge variant={variants[props.status]}>{t(`app_status_${props.status}`)}</Badge>;
}
