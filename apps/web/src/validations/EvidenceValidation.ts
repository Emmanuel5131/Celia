import {
  chainIds,
  evidenceReviewStates,
  evidenceTypes,
  isAnalysisType,
  isReferenceType,
  isValidChainReference,
} from '@celia/core';
import * as z from 'zod';
import { forbiddenWords } from '@/validations/ReportValidation';

const words = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !forbiddenWords.test(value), { message: 'forbidden_words' });

const https = z.url({ protocol: /^https$/u }).max(300);

/**
 * A piece of evidence as staff enter it, apart from the file itself, which is checked on upload. The house language applies from the
 * start, as it does for a statement. A link needs where it is; a wallet or transaction needs its chain and a well-formed reference.
 * A file type has no fields here beyond the common ones: it needs the file.
 */
export const EvidenceValidation = z
  .object({
    type: z.enum(evidenceTypes),
    title: words(120),
    note: words(500).optional(),
    sourceUrl: https.optional(),
    capturedOn: z.iso.date().optional(),
    chain: z.enum(chainIds).optional(),
    reference: z.string().trim().min(1).max(128).optional(),
    statementId: z.uuid().optional(),
    actionId: z.uuid().optional(),
    /** Staff confirm the material is public and lawful to show. */
    lawful: z.literal(true),
  })
  .superRefine((value, context) => {
    const fail = (path: string, message: string) => {
      context.addIssue({ code: 'custom', path: [path], message });
    };

    if ((value.type === 'link' || isAnalysisType(value.type)) && !value.sourceUrl) {
      fail('sourceUrl', 'required');
    }

    if (isReferenceType(value.type)) {
      if (!value.chain || !value.reference) {
        fail('reference', 'required');
      } else if (
        !isValidChainReference({ type: value.type, chain: value.chain, reference: value.reference })
      ) {
        fail('reference', 'format');
      }
    }
  });

/** The most pieces of evidence a case holds besides statements: enough to back the case, few enough to stay a brief. */
export const maxEvidence = 20;

/** A review of off-chain evidence: where it stands and what was found, in the house language. */
export const EvidenceReviewValidation = z.object({
  state: z.enum(evidenceReviewStates),
  note: words(500).optional(),
});
