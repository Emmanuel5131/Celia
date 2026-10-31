import * as z from 'zod';
import { checkResults, idPattern, limitedText } from '@/validations/ReportValidation';

// The limits are the report's own (see `ReportValidation`), so findings that pass here are accepted when the report is saved.
const hash = z.string().trim().min(1).max(100);

/** A small chart of one test, as data: Celia draws it with its own colours. At most 30 points and 4 series, so it stays small. */
const ChartValidation = z
  .object({
    type: z.enum(['bar', 'line']),
    x: z.array(limitedText(40)).min(1).max(30),
    series: z
      .array(
        z.object({
          name: limitedText(40),
          values: z.array(z.number()).min(1).max(30),
        }),
      )
      .min(1)
      .max(4),
    /** A fixed threshold the finding is measured against, drawn as the seal-red dashed line. */
    threshold: z.object({ value: z.number(), label: limitedText(40) }).optional(),
  })
  .refine((chart) => chart.series.every((series) => series.values.length === chart.x.length), {
    message: 'chart_shape',
  });

/** One test as the notebook wrote it. The verdict comes from a rule fixed before the run, not from anyone's judgement after it. */
const TestFindingValidation = z
  .object({
    id: z.string().regex(idPattern),
    title: limitedText(120),
    /** Built by the notebook from its own numbers, so the figures in the words cannot drift from the table. */
    summary: limitedText(600),
    verdict: z.enum(checkResults),
    columns: z.array(limitedText(40)).min(1).max(8),
    rows: z
      .array(z.array(limitedText(120)).max(8))
      .min(1)
      .max(50),
    chart: ChartValidation.optional(),
  })
  .refine((test) => test.rows.every((row) => row.length === test.columns.length), {
    message: 'table_shape',
  });

/**
 * The file a template notebook writes at the end of a run (`./data/case-<seq>/run-<n>/findings.json`), which the assistant reads
 * with `read_file`. It is the contract between the notebook and Celia: every test with its table and verdict, and the facts of
 * the run. Celia takes the report's tests and verdicts from it, so words can be written around them but not over them.
 */
export const FindingsValidation = z
  .object({
    celia: z.literal(1),
    run: z.object({
      templateId: z.string().regex(idPattern),
      templateVersion: z.string().trim().min(1).max(20),
      /** The notebook the run happened in, so a lawyer can open it. https only; no claimant data in it. */
      notebookUrl: z
        .url({ protocol: /^https$/u })
        .max(300)
        .optional(),
      /** What Sandworm's attestation exposes, when the notebook was attested. */
      attestation: z
        .object({
          codeHash: hash.optional(),
          inputHash: hash.optional(),
          requestHash: hash.optional(),
          requestTx: hash.optional(),
        })
        .optional(),
      /** When the chain data was read, as an ISO time. */
      dataAsOf: z.iso.datetime(),
    }),
    tests: z.array(TestFindingValidation).min(1).max(20),
  })
  .superRefine((findings, context) => {
    const ids = findings.tests.map((test) => test.id);

    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate_test', path: ['tests'] });
    }
  });
