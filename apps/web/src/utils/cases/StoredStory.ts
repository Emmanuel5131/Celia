/** One place where the platform said one thing and the chain shows another. `order` is the statement's place in the case. */
type StoredContradiction = { order: number; platformSaid: string; chainShows: string };

/** What the stored story of a case holds besides its counts. */
export type StoredStory = { contradictions: StoredContradiction[] };

/** How long a stored story is trusted before it is rebuilt on the next read, in case a change forgot to rebuild it. */
export const storyMaxAgeMs = 60 * 60 * 1000;

/** The note every telling of the story ends with. */
export const storyNote =
  'Claimants’ own accounts, counted. Not a finding of fraud: a court decides.';
