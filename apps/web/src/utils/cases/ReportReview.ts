/**
 * Where a report is in review. An assistant drafts it (`drafted`), an assistant reviews the draft (`agent_reviewed`), and a person
 * approves it (`approved`) or sends it back (`sent_back`). Only an approved report is shown outside the staff area.
 */
const reportReviews = ['drafted', 'agent_reviewed', 'approved', 'sent_back'] as const;

export type ReportReview = (typeof reportReviews)[number];

/**
 * What the assistant's review of a draft found, and the message it prepared for the person who decides. The person answers yes or
 * no to it; `concerns` still goes to them, with the message saying what to look at.
 */
export type AgentReportReview = {
  verdict: 'pass' | 'concerns';
  /** The assistant's message to the person: what the report says, what it checked, what to look at, and what it recommends. */
  message: string;
  /** ISO time of the review. */
  at: string;
};

/** The states in which a report is still being looked at by staff, so it is not yet the report shown to others. */
export const unapprovedReviews = ['drafted', 'agent_reviewed'] as const satisfies ReportReview[];
