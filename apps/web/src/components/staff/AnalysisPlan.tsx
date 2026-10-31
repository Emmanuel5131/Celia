'use client';

import type { Brief, PreflightProblem } from '@celia/core';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { approveAnalysisBrief } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { AnalysisBriefSummary, AnalysisProblems } from '@/components/staff/AnalysisParts';
import { useConfirmedTransition } from '@/components/staff/ConfirmAction';
import { Button } from '@/components/ui/button';

/**
 * Where staff plan the research of one statement: what is still missing, what the agent will look at, then approve. Approving is
 * the only step that spends compute, and only a person can take it. The page refreshes by itself after each change.
 * @param props - The plan props.
 * @param props.caseId - The case id.
 * @param props.statementId - The statement to research.
 * @param props.problems - What stops the analysis, and what to note.
 * @param props.brief - What the agent would look at, when nothing blocks.
 * @returns The plan.
 */
export function AnalysisPlan(props: {
  caseId: string;
  statementId: string;
  problems: PreflightProblem[];
  brief: Brief | null;
}) {
  const t = useTranslations('Staff');
  const [message, setMessage] = React.useState<string | null>(null);
  const { pending, startTransition, dialog } = useConfirmedTransition();

  // What stops an analysis (too few claims, no template, sealed) is not something to fix here, so a form would only be noise: say
  // why, and wait.
  const blockers = props.problems.filter((problem) => problem.blocking);

  if (blockers.length > 0) {
    return (
      <div className="grid gap-4">
        <AnalysisProblems problems={blockers} title={t('plan_not_ready_title')} />
        <p className="text-sm text-ink-muted">{t('plan_not_ready_text')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <AnalysisProblems problems={props.problems} />
      {props.brief && <AnalysisBriefSummary brief={props.brief} />}
      <div className="grid gap-4">
        <Button
          className="justify-self-start"
          disabled={pending || !props.brief}
          onClick={() => {
            startTransition(async () => {
              const result = await approveAnalysisBrief(props.caseId, props.statementId);
              // An approved plan moves the statement to the next step, so only a refusal needs a message here.
              setMessage(result.status === 'approved' ? null : t('brief_approve_blocked'));
            });
          }}
        >
          {t('brief_approve')}
        </Button>
        {message && <output className="text-sm">{message}</output>}
        {dialog}
      </div>
    </div>
  );
}
