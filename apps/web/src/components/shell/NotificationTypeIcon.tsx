import type { NotificationType } from '@celia/core';
import {
  CheckCircleIcon,
  FolderOpenIcon,
  GavelIcon,
  HourglassIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  ShieldCheckIcon,
  WalletIcon,
  XCircleIcon,
} from '@phosphor-icons/react/ssr';

// One icon for every kind of notification. The record is exhaustive, so a new type cannot be added without choosing its icon.
const icons: Record<NotificationType, React.ComponentType> = {
  claim_submitted: PaperPlaneTiltIcon,
  ownership_confirmed: WalletIcon,
  claim_validated: CheckCircleIcon,
  claim_in_review: MagnifyingGlassIcon,
  claim_rejected: XCircleIcon,
  application_rejected: XCircleIcon,
  claim_in_case: FolderOpenIcon,
  case_sealed: CheckCircleIcon,
  case_taken: GavelIcon,
  counsel_received: HourglassIcon,
  counsel_verified: ShieldCheckIcon,
  counsel_review_reset: HourglassIcon,
  case_ready_for_counsel: CheckCircleIcon,
  case_taken_by_you: GavelIcon,
  contact_request: PaperPlaneTiltIcon,
  contact_request_decided: CheckCircleIcon,
};

/**
 * The icon that says what kind of notification it is, for the marker of a timeline item.
 * @param props - The icon props.
 * @param props.type - The notification type.
 * @returns The icon.
 */
export function NotificationTypeIcon(props: { type: NotificationType }) {
  const Icon = icons[props.type];

  return <Icon aria-hidden="true" />;
}
