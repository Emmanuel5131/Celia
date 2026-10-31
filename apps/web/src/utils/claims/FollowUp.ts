/** How a person wants Celia to reach them about their claim. `email` uses the address on their account. */
export const followUpChannels = ['email', 'phone', 'messaging'] as const;

export type FollowUpChannel = (typeof followUpChannels)[number];
