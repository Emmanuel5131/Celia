import { chainIds, evidenceReviewStates, statementKinds } from '@celia/core';
import * as z from 'zod';
import {
  addCaseAction,
  addCaseEvidence,
  addCaseOperator,
  addPlatformStatement,
  allowMail,
  approveAnalysisBrief,
  approveApplication,
  declineWalletProof,
  disconnectSandworm,
  markApplicationReady,
  rejectApplication,
  rejectClaims,
  removeCaseAction,
  removeCaseEvidence,
  removeCaseOperator,
  removePlatformStatement,
  retryMail,
  reviewCaseEvidence,
  runApplicationLookups,
  setApplicationCheck,
  setCaseStatus,
  startClaimReviews,
  updateCaseAction,
  updateCaseEvidence,
  updateCaseOperator,
  updatePlatformStatement,
  validateClaims,
} from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { listAllClaimsToValidate } from '@/libs/accounts/Staff';
import { listEvidence } from '@/libs/analysis/Evidence';
import { listStatements } from '@/libs/analysis/Statements';
import { listActions } from '@/libs/cases/Actions';
import { getCase } from '@/libs/cases/Cases';
import { gatherEvidenceChecks } from '@/libs/claims/ClaimChecks';
import { rejectReasons, reviewChecks } from '@/utils/accounts/Institution';
import { caseStatuses } from '@/utils/cases/Case';
import { operatorRoles } from '@/utils/cases/Operators';
import {
  badLinkNote,
  invalidAddressNote,
  lowEvidenceNote,
  splitByEvidence,
} from '@/utils/claims/ClaimEvidence';

/** What a change did: whether it went through, what refused it when it did not, and anything it counted. */
type Outcome = { ok: boolean; problems?: string[]; result?: unknown };

type Operation<Input extends z.ZodType> = {
  input: Input;
  /** One plain sentence on what will change, shown to the staff member before they confirm. */
  describe: (input: z.infer<Input>) => Promise<string> | string;
  run: (input: z.infer<Input>) => Promise<Outcome>;
};

/** An operation with its input type hidden, so they can sit in one list. */
type Prepared = {
  prepare: (raw: unknown) => Promise<{ summary: string; run: () => Promise<Outcome> } | null>;
};

function define<Input extends z.ZodType>(operation: Operation<Input>): Prepared {
  return {
    prepare: async (raw) => {
      const parsed = operation.input.safeParse(raw);

      return parsed.success
        ? {
            summary: await operation.describe(parsed.data),
            run: async () => await operation.run(parsed.data),
          }
        : null;
    },
  };
}

const id = z.uuid();
const fileEvidenceTypes = new Set<string>(['video', 'image', 'document']);
const text = (max: number) => z.string().trim().min(1).max(max);

const form = (fields: Record<string, string | undefined>) => {
  const data = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      data.set(key, value);
    }
  }

  return data;
};

// Actions that report what failed as a list of names: none means it went through.
const listed = (problems: string[]): Outcome => ({ ok: problems.length === 0, problems });

// Actions that report how many claims they changed and skipped.
const counted = (result: { done: number; skipped: number; error?: string }): Outcome => ({
  ok: result.done > 0 && result.error === undefined,
  problems: result.error ? [result.error] : undefined,
  result,
});

// Actions that answer `ok` or the reason they refused.
const answered = (answer: string): Outcome => ({
  ok: answer === 'ok',
  problems: answer === 'ok' ? undefined : [answer],
});

const caseName = async (caseId: string) => {
  const found = await getCase(caseId);

  return found?.name ?? 'an unknown case';
};

/** How many waiting claims are checked, and then turned down, as one piece of work. */
const triageChunk = 96;

/** How long one triage call works before it stops and reports what is left, so the call finishes inside the host's time limit. */
const triageBudgetMs = 40_000;

/**
 * Everything staff can change in the web app, as operations the MCP server can ask for. Each one runs the same action the web app
 * runs, as the signed-in staff member, so the same rules, the same checks and the same audit apply. The route that serves them
 * asks for confirmation first, using `describe`.
 */
export const staffOperations: Record<string, Prepared> = {
  add_alleged_action: define({
    input: z.object({
      caseId: id,
      title: text(200),
      kind: z.string().trim().max(80).optional(),
      occurredOn: z.iso.date().optional(),
      jurisdiction: z.string().optional(),
      note: z.string().trim().max(1000).optional(),
    }),
    describe: async (input) =>
      `Add the alleged action "${input.title}" to the case ${await caseName(input.caseId)}.`,
    run: async (input) => listed(await addCaseAction(input.caseId, form(input))),
  }),

  update_alleged_action: define({
    input: z.object({
      caseId: id,
      actionId: id,
      title: text(200),
      kind: z.string().trim().max(80).optional(),
      occurredOn: z.iso.date().optional(),
      jurisdiction: z.string().optional(),
      note: z.string().trim().max(1000).optional(),
    }),
    describe: async (input) => {
      const all = await listActions(input.caseId);
      const found = all.find((item) => item.id === input.actionId);

      return `Change the alleged action "${found?.title ?? input.actionId}" to "${input.title}". Anything you leave out is cleared.`;
    },
    run: async (input) => listed(await updateCaseAction(input.caseId, input.actionId, form(input))),
  }),

  update_alleged_actor: define({
    input: z.object({
      caseId: id,
      index: z.number().int().min(0),
      name: text(120),
      role: z.enum(operatorRoles).optional(),
      roleNote: z.string().trim().max(80).optional(),
      jurisdiction: z.string().optional(),
      notes: z.string().trim().max(1000).optional(),
    }),
    describe: async (input) => {
      const current = await getCase(input.caseId);
      const found = current?.operators.at(input.index);

      return `Change the alleged actor "${found?.name ?? `number ${input.index}`}" to "${input.name}". Anything you leave out is cleared.`;
    },
    run: async (input) =>
      listed(
        await updateCaseOperator(input.caseId, input.index, form({ ...input, index: undefined })),
      ),
  }),

  update_statement: define({
    input: z.object({
      caseId: id,
      statementId: id,
      text: text(500),
      sourceUrl: z.url({ protocol: /^https$/u }),
      kind: z.enum(statementKinds),
    }),
    describe: async (input) => {
      const all = await listStatements(input.caseId);
      const found = all.find((item) => item.id === input.statementId);

      return `Change the statement "${found?.text ?? input.statementId}" to "${input.text}". Only a statement nobody has planned research for can change.`;
    },
    run: async (input) =>
      listed(await updatePlatformStatement(input.caseId, input.statementId, form(input))),
  }),

  update_evidence: define({
    input: z.object({
      caseId: id,
      evidenceId: id,
      type: z.enum([
        'link',
        'wallet',
        'transaction',
        'notebook',
        'chat',
        'script',
        'video',
        'image',
        'document',
      ]),
      title: text(120),
      note: z.string().trim().max(500).optional(),
      sourceUrl: z.url({ protocol: /^https$/u }).optional(),
      capturedOn: z.iso.date().optional(),
      chain: z.enum(chainIds).optional(),
      reference: z.string().trim().max(128).optional(),
      statementId: id.optional(),
      actionId: id.optional(),
    }),
    describe: async (input) => {
      const all = await listEvidence(input.caseId);
      const found = all.find((item) => item.id === input.evidenceId);

      return `Change the evidence "${found?.title ?? input.evidenceId}" to "${input.title}". Its kind and its file cannot change. Anything you leave out is cleared.`;
    },
    run: async (input) =>
      listed(await updateCaseEvidence(input.caseId, input.evidenceId, form(input))),
  }),

  remove_alleged_action: define({
    input: z.object({ caseId: id, actionId: id }),
    describe: async (input) => {
      const all = await listActions(input.caseId);
      const found = all.find((item) => item.id === input.actionId);

      return `Remove the alleged action "${found?.title ?? input.actionId}" from the case. Evidence attached to it stays on the case.`;
    },
    run: async (input) => {
      await removeCaseAction(input.caseId, input.actionId);

      return { ok: true };
    },
  }),

  add_alleged_actor: define({
    input: z.object({
      caseId: id,
      name: text(120),
      role: z.enum(operatorRoles).optional(),
      roleNote: z.string().trim().max(80).optional(),
      jurisdiction: z.string().optional(),
      notes: z.string().trim().max(1000).optional(),
    }),
    describe: async (input) =>
      `Add "${input.name}" as an alleged actor in the case ${await caseName(input.caseId)}.`,
    run: async (input) => listed(await addCaseOperator(input.caseId, form(input))),
  }),

  remove_alleged_actor: define({
    input: z.object({ caseId: id, index: z.number().int().min(0) }),
    describe: async (input) => {
      const current = await getCase(input.caseId);
      const found = current?.operators.at(input.index);

      return `Remove the alleged actor "${found?.name ?? `number ${input.index}`}" from the case.`;
    },
    run: async (input) => {
      await removeCaseOperator(input.caseId, input.index);

      return { ok: true };
    },
  }),

  add_statement: define({
    input: z.object({
      caseId: id,
      text: text(500),
      sourceUrl: z.url({ protocol: /^https$/u }),
      kind: z.enum(statementKinds),
    }),
    describe: async (input) =>
      `Add the statement "${input.text}" the platform made, said at ${input.sourceUrl}, to the case ${await caseName(input.caseId)}.`,
    run: async (input) => listed(await addPlatformStatement(input.caseId, form(input))),
  }),

  remove_statement: define({
    input: z.object({ caseId: id, statementId: id }),
    describe: async (input) => {
      const all = await listStatements(input.caseId);
      const found = all.find((item) => item.id === input.statementId);

      return `Remove the statement "${found?.text ?? input.statementId}" from the case.`;
    },
    run: async (input) => {
      await removePlatformStatement(input.caseId, input.statementId);

      return { ok: true };
    },
  }),

  add_evidence: define({
    input: z
      .object({
        caseId: id,
        type: z.enum([
          'link',
          'wallet',
          'transaction',
          'notebook',
          'chat',
          'script',
          'video',
          'image',
          'document',
        ]),
        title: text(120),
        note: z.string().trim().max(500).optional(),
        sourceUrl: z.url({ protocol: /^https$/u }).optional(),
        capturedOn: z.iso.date().optional(),
        chain: z.enum(chainIds).optional(),
        reference: z.string().trim().max(128).optional(),
        statementId: id.optional(),
        actionId: id.optional(),
        /** Pinata's id for a video, image or document already uploaded with start_evidence_upload. */
        pinId: z.string().trim().min(1).max(128).optional(),
        /** The staff member confirms the material is public and lawful to show. */
        lawful: z.literal(true),
      })
      .refine((input) => !fileEvidenceTypes.has(input.type) || input.pinId !== undefined),
    describe: async (input) =>
      `Add the ${input.type} "${input.title}" as evidence to the case ${await caseName(input.caseId)}. It is public material, and staff have confirmed it is lawful to show.`,
    run: async (input) =>
      listed(await addCaseEvidence(input.caseId, form({ ...input, lawful: 'on' }))),
  }),

  review_evidence: define({
    input: z.object({
      caseId: id,
      evidenceId: id,
      state: z.enum(evidenceReviewStates),
      note: z.string().trim().max(500).optional(),
    }),
    describe: async (input) => {
      const all = await listEvidence(input.caseId);
      const found = all.find((item) => item.id === input.evidenceId);

      return `Record the review of the off-chain evidence "${found?.title ?? input.evidenceId}" as ${input.state.replaceAll('_', ' ')}${input.note ? `, with the note: ${input.note}` : ''}.`;
    },
    run: async (input) =>
      listed(
        await reviewCaseEvidence(
          input.caseId,
          input.evidenceId,
          form({ state: input.state, note: input.note }),
        ),
      ),
  }),

  remove_evidence: define({
    input: z.object({ caseId: id, evidenceId: id }),
    describe: async (input) => {
      const all = await listEvidence(input.caseId);
      const found = all.find((item) => item.id === input.evidenceId);

      return `Remove the evidence "${found?.title ?? input.evidenceId}" from the case. Copies others took of a public file cannot be recalled.`;
    },
    run: async (input) => {
      await removeCaseEvidence(input.caseId, input.evidenceId);

      return { ok: true };
    },
  }),

  approve_analysis_brief: define({
    input: z.object({ caseId: id, statementId: id }),
    describe: async (input) => {
      const all = await listStatements(input.caseId);
      const found = all.find((item) => item.id === input.statementId);

      return `Approve the research plan for the statement "${found?.text ?? input.statementId}". This spends compute, and the plan is fixed before the data is read.`;
    },
    run: async (input) => {
      const result = await approveAnalysisBrief(input.caseId, input.statementId);

      return { ok: result.status === 'approved', result };
    },
  }),

  set_case_stage: define({
    input: z.object({ caseId: id, status: z.enum(caseStatuses) }),
    describe: async (input) =>
      `Move the case ${await caseName(input.caseId)} to "${input.status}".${input.status === 'sealed' ? ' Sealing tells claimants their evidence is final and tells verified lawyers the case is ready to take.' : ''}`,
    run: async (input) => {
      await setCaseStatus(input.caseId, input.status);
      const after = await getCase(input.caseId);
      const stage = after?.status;

      // Sealing needs a report, so a refused move leaves the stage as it was.
      return { ok: stage === input.status, result: { stage } };
    },
  }),

  start_claim_reviews: define({
    input: z.object({ claimIds: z.array(id).min(1).max(100) }),
    describe: (input) =>
      `Start the review of ${input.claimIds.length} claim(s). Each person is told it is in review.`,
    run: async (input) => counted(await startClaimReviews(input.claimIds)),
  }),

  accept_claims: define({
    input: z.object({ claimIds: z.array(id).min(1).max(100) }),
    describe: (input) =>
      `Accept ${input.claimIds.length} claim(s). Each person is told it was accepted, the claim joins the case for its platform, and any wallet proof they added is marked as checked.`,
    run: async (input) => counted(await validateClaims(input.claimIds)),
  }),

  reject_claims: define({
    input: z.object({ claimIds: z.array(id).min(1).max(100), note: text(500) }),
    describe: (input) =>
      `Reject ${input.claimIds.length} claim(s) with the reason "${input.note}". Each person is told and sees the reason.`,
    run: async (input) => counted(await rejectClaims(input)),
  }),

  triage_claims: define({
    input: z.object({
      note: text(500).optional(),
      skip: z.number().int().min(0).optional(),
    }),
    describe: async (input) => {
      const all = await listAllClaimsToValidate();
      const waiting = all.length - (input.skip ?? 0);

      return `Check up to ${Math.max(waiting, 0)} waiting claim(s) against the evidence rule, a piece at a time, and reject the ones whose evidence is bad: an address that is not valid for its chain, a video link that is not a link or did not open, or no wallet signature, file or video and no wallet activity. Each person is told and sees the reason${input.note ? ` "${input.note}"` : ' for its group'}. The rest stay waiting for staff. If time runs out it stops, keeps what it has done and says where to carry on.`;
    },
    run: async (input) => {
      const started = Date.now();
      const skip = input.skip ?? 0;
      const all = await listAllClaimsToValidate();
      const waiting = all.slice(skip);
      let checked = 0;
      let done = 0;
      let skipped = 0;

      for (let start = 0; start < waiting.length; start += triageChunk) {
        if (Date.now() - started > triageBudgetMs) {
          break;
        }

        const claims = waiting.slice(start, start + triageChunk);
        // oxlint-disable-next-line no-await-in-loop -- each piece is saved before the next is read, so a cut-off loses nothing done
        const checks = await gatherEvidenceChecks(claims);
        const { invalidAddress, badLink, nothing } = splitByEvidence(claims, checks);

        for (const [ids, note] of [
          [invalidAddress, input.note ?? invalidAddressNote],
          [badLink, input.note ?? badLinkNote],
          [nothing, input.note ?? lowEvidenceNote],
        ] as const) {
          if (ids.length > 0) {
            // oxlint-disable-next-line no-await-in-loop -- one reason at a time
            const batch = await rejectClaims({ claimIds: ids, note });

            done += batch.done;
            skipped += batch.skipped;

            if (batch.error) {
              return { ok: false, problems: [batch.error], result: { checked, done, skipped } };
            }
          }
        }

        checked += claims.length;
      }

      // The claims kept stay at the front of the queue, so the next call skips them and goes straight on to the ones not yet read.
      return {
        ok: checked > 0,
        result: {
          checked,
          rejected: done,
          notRejected: skipped,
          left: waiting.length - checked,
          nextSkip: skip + checked - done,
        },
      };
    },
  }),

  decline_wallet_proof: define({
    input: z.object({ claimId: id, note: text(500) }),
    describe: (input) =>
      `Turn down the wallet proof on claim ${input.claimId} with the reason "${input.note}". Their files are deleted and they are asked for new proof; the claim stays waiting.`,
    run: async (input) => counted(await declineWalletProof(input)),
  }),

  set_application_check: define({
    input: z.object({ userId: text(100), check: z.enum(reviewChecks), value: z.boolean() }),
    describe: (input) =>
      `${input.value ? 'Tick' : 'Untick'} the check "${input.check}" on the application ${input.userId}. Changing a check takes off the ready mark.`,
    run: async (input) => {
      await setApplicationCheck(input);

      return { ok: true };
    },
  }),

  run_application_lookups: define({
    input: z.object({ userId: text(100) }),
    describe: (input) => `Run the public-record lookups for the application ${input.userId}.`,
    run: async (input) => {
      await runApplicationLookups(input.userId);

      return { ok: true };
    },
  }),

  mark_application_ready: define({
    input: z.object({ userId: text(100) }),
    describe: (input) =>
      `Mark the application ${input.userId} ready for a second person to approve. Every check must be ticked.`,
    run: async (input) => answered(await markApplicationReady(input.userId)),
  }),

  approve_application: define({
    input: z.object({ userId: text(100) }),
    describe: (input) =>
      `Approve the application ${input.userId}, which opens the account. It needs every check ticked and a second person: the one who marked it ready cannot approve it in production.`,
    run: async (input) => answered(await approveApplication(input.userId)),
  }),

  reject_application: define({
    input: z
      .object({
        userId: text(100),
        reason: z.enum(rejectReasons).optional(),
        note: z.string().trim().max(500).optional(),
      })
      .refine((input) => input.reason !== undefined || (input.note ?? '') !== ''),
    describe: (input) =>
      `Reject the application ${input.userId}${input.reason ? ` for the reason "${input.reason}"` : ''}${input.note ? ` with the note "${input.note}"` : ''}. The reason is shown to the applicant.`,
    run: async (input) => answered(await rejectApplication(input)),
  }),

  retry_mail: define({
    input: z.object({ id }),
    describe: (input) => `Put the failed email ${input.id} back in the queue to be tried again.`,
    run: async (input) => {
      await retryMail(input.id);

      return { ok: true };
    },
  }),

  allow_mail: define({
    input: z.object({ email: z.email() }),
    describe: (input) => `Allow mail to ${input.email} again, after it bounced or complained.`,
    run: async (input) => {
      await allowMail(input.email);

      return { ok: true };
    },
  }),

  disconnect_sandworm: define({
    input: z.object({}),
    describe: () =>
      'Disconnect your Sandworm sign-in from Celia. You will need to connect it again in the staff area.',
    run: async () => {
      await disconnectSandworm();

      return { ok: true };
    },
  }),
};
