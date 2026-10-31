/** What a person, group or account is alleged to have done: run or promote a platform, handle the money, build it, or hack it. */
export const operatorRoles = ['runs', 'promotes', 'money', 'developer', 'hacker', 'other'] as const;

type OperatorRole = (typeof operatorRoles)[number];

/** One person or group the claimants allege is behind a platform. It records what is alleged and is never a finding. */
export type CaseOperator = {
  name: string;
  /** What they are alleged to do; empty when staff have not said. */
  role: OperatorRole | null;
  /** The role in staff's own words, which is required when the role is `other` and empty otherwise. */
  roleNote: string | null;
  /** The jurisdiction id they are linked to, such as where a company is registered. */
  jurisdiction: string | null;
  /** Names, handles and links, in the house language. */
  notes: string | null;
};
