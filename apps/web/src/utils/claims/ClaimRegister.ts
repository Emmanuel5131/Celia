/** Which claims the staff register shows: all of them, or those in one state. */
export const registerStates = [
  'all',
  'draft',
  'sent',
  'in_review',
  'accepted',
  'rejected',
] as const;

export type RegisterState = (typeof registerStates)[number];

/** How many claims one page of the staff register holds. */
export const registerPageSize = 25;
