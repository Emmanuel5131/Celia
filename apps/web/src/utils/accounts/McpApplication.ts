import type { ApplicationInReview } from '@/libs/accounts/Applications';

/**
 * Shapes an application for the MCP server: everything staff check, without the applicant's name or email.
 * @param item - The application as the staff page shows it.
 * @returns The application without the applicant's name and email.
 */
export function applicationForMcp(item: ApplicationInReview) {
  const { name: _name, email: _email, ...rest } = item;

  return rest;
}
