import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ContactRequestStatus } from '@/utils/contact/ContactRequest';

const variants = {
  draft: 'muted',
  submitted: 'dashed',
  agent_reviewed: 'dashed',
  approved: 'solid',
  rejected: 'seal',
  withdrawn: 'muted',
} as const;

/**
 * Where a request to contact claimants stands, as a tag: dashed while it waits for staff, solid once approved, seal when refused.
 * @param props - The badge props.
 * @param props.status - The request's status.
 * @returns The tag.
 */
export function ContactRequestStatusBadge(props: { status: ContactRequestStatus }) {
  const t = useTranslations('Staff');

  return <Badge variant={variants[props.status]}>{t(`cr_status_${props.status}`)}</Badge>;
}
