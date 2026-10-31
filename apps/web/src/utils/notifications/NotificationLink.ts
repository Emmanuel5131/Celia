import type { NotificationType } from '@celia/core';

/**
 * Where a notification leads, as an app path without a language prefix. Every link goes to the signed-in app: an email never
 * carries claim detail, so the page behind the link is where the person reads it.
 * @param type - The notification type.
 * @param data - The ids the notification carries.
 * @returns The path.
 */
export function notificationPath(type: NotificationType, data: Record<string, string>) {
  switch (type) {
    case 'claim_submitted':
    case 'ownership_confirmed':
    case 'claim_validated':
    case 'claim_in_review':
    case 'claim_rejected': {
      return data.claimId ? `/dashboard/claims/${data.claimId}` : '/dashboard/claims';
    }
    case 'claim_in_case':
    case 'case_sealed':
    case 'case_taken':
    case 'case_ready_for_counsel':
    case 'case_taken_by_you': {
      return data.caseId ? `/dashboard/cases/${data.caseId}` : '/dashboard/cases';
    }
    case 'counsel_received':
    case 'counsel_verified':
    case 'counsel_review_reset': {
      return '/dashboard/settings';
    }
    case 'contact_request': {
      return '/dashboard/requests';
    }
    case 'contact_request_decided': {
      return '/dashboard/contact';
    }
    case 'application_rejected': {
      return '/dashboard';
    }
    default: {
      return '/dashboard';
    }
  }
}
