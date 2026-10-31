/** The shape shared by the privacy notice and the terms, so one section renders both. */
export type LegalBlock =
  | { p: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export type LegalDocument = {
  path: string;
  title: string;
  lead: string;
  /** Shown as "Last updated". */
  updated: string;
  sections: LegalSection[];
};

/** Where people write about their data, a scam using the name or a dispute. */
export const legalEmail = 'ceelia1248@gmail.com';
