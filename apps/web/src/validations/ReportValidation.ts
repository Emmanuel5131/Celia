import * as z from 'zod';

/** What the chain showed about one thing a platform said. `not_checkable` means the chain cannot show it, so it is not guessed. */
export const checkResults = ['proven', 'partly_proven', 'not_proven', 'not_checkable'] as const;

export type CheckResult = (typeof checkResults)[number];

// Words Celia does not use: they declare fraud or promise an outcome. The court decides intent; the report only says what the
// chain shows. Kept short and literal on purpose: it catches slips, and a person still reviews every report before it is saved.
export const forbiddenWords =
  /\b(scam\w*|fraud detected|guarantee[ds]?|recover your money|expos(?:e|es|ed|ing))\b/iu;

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' });

/** A link outside Celia that backs a check up, such as a transaction or an address on a block explorer. https only. */
const ProofValidation = z.object({
  label: text(80),
  url: z.url({ protocol: /^https$/u }),
});

const idPattern = /^[a-z\d-]{1,40}$/u;

/**
 * One test that was run, with its output kept inside the report. A check points at the tests that back it, so a lawyer can go
 * from a finding to the numbers behind it without leaving Celia.
 */
const TestValidation = z
  .object({
    /** Lowercase letters, digits and dashes. Checks refer to it. */
    id: z.string().regex(idPattern),
    title: text(120),
    /** What the test found, in words. */
    summary: text(600),
    /** The output as a table, when there is one. At most 8 columns and 50 rows. */
    columns: z.array(text(40)).min(1).max(8).optional(),
    rows: z
      .array(z.array(text(120)).max(8))
      .max(50)
      .optional(),
  })
  .refine(
    (test) =>
      !test.rows || (test.columns && test.rows.every((row) => row.length === test.columns?.length)),
    {
      message: 'table_shape',
    },
  );

const CheckValidation = z.object({
  /** What the platform said, in its own words or close to them. */
  claim: text(500),
  /** What the chain shows about it. */
  evidence: text(1000),
  result: z.enum(checkResults),
  /** The ids of the tests in this report that back the finding. */
  tests: z.array(z.string().regex(idPattern)).max(5).optional(),
  /** Links outside Celia, such as a transaction on a block explorer. Up to five. */
  proof: z.array(ProofValidation).max(5).optional(),
});

const FigureValidation = z.object({
  label: text(60),
  value: text(40),
  note: text(120).optional(),
});

/**
 * The findings of one analysis, frozen. The analysis is run and the findings checked by staff, and Celia keeps them as the
 * record, tests and their outputs included, so they can be shown the same way forever and their hash checked. It holds public
 * facts only: counts, addresses of the platform, what the tests found. Never a claimant's name, wallet or statement.
 */
export const ReportValidation = z
  .object({
    version: z.literal(1),
    /** One sentence in the house language: what the chain shows and does not. */
    headline: text(300),
    /** The two numbers the case preview shows. Optional: reports saved before it existed have none. */
    estimate: z
      .object({
        /** How many wallets sent funds to the platform, as read from the chain. */
        wallets: text(40),
        /** How much those wallets sent, as read from the chain. Never a claimant's own figure. */
        losses: text(40),
        /** The same loss in whole US dollars. It decides when a case starts building evidence. Optional: older reports have none. */
        lossUsd: z.number().int().nonnegative().optional(),
      })
      .optional(),
    /** Up to four big numbers, such as wallets involved or total received. */
    figures: z.array(FigureValidation).max(4),
    checks: z.array(CheckValidation).min(1).max(20),
    /** The tests that were run, with their outputs. */
    tests: z.array(TestValidation).min(1).max(20),
    method: z.object({
      /** The hash the method was committed under before the data was read, when it was. */
      commitment: z
        .string()
        .regex(/^0x[\da-f]{64}$/iu)
        .optional(),
      /** The published notebook the analysis was run in, so a lawyer can open it and check it. https only; no claimant data in it. */
      notebookUrl: z
        .url({ protocol: /^https$/u })
        .max(300)
        .optional(),
    }),
    /** When the chain data was read, as an ISO time. */
    dataAsOf: z.iso.datetime(),
    sources: z.array(text(120)).max(10),
  })
  .superRefine((report, context) => {
    const ids = report.tests.map((test) => test.id);

    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate_test', path: ['tests'] });
    }

    for (const [index, check] of report.checks.entries()) {
      if (check.tests?.some((id) => !ids.includes(id))) {
        context.addIssue({
          code: 'custom',
          message: 'unknown_test',
          path: ['checks', index, 'tests'],
        });
      }
    }
  });

/**
 * What a new report must satisfy: every test has a table, with columns and at least one row, so the analysis shows the numbers
 * behind each finding. Reports saved before this rule still read with `ReportValidation`, and show a note where a test has no table.
 */
export const NewReportValidation = ReportValidation.refine(
  (report) => report.tests.every((test) => test.columns && test.rows && test.rows.length > 0),
  { message: 'table_required' },
);

export type Report = z.infer<typeof ReportValidation>;
