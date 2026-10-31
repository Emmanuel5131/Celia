import * as z from 'zod';
import {
  ChartValidation,
  checkResults,
  idPattern,
  limitedText,
} from '@/validations/ReportValidation';

// The limits are the report's own (see `ReportValidation`), so findings that pass here are accepted when the report is saved.
const hash = z.string().trim().min(1).max(100);

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
    charts: z.array(ChartValidation).max(3).optional(),
    notes: z.array(limitedText(300)).max(5).optional(),
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
