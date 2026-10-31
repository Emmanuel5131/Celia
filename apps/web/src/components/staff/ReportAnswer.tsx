'use client';

import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { answerCaseReport } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { Button } from '@/components/ui/button';

/**
 * The person's answer to a report the assistant reviewed: yes publishes it, no sends it back. Two buttons and nothing else, so
 * the decision is the click.
 * @param props - The button props.
 * @param props.caseId - The case id.
 * @param props.run - The analysis run number.
 * @param props.version - The version of that analysis's report.
 * @returns The two buttons, and the reason when the answer was refused.
 */
export function ReportAnswer(props: { caseId: string; run: number; version: number }) {
  const t = useTranslations('Staff');
  const [pending, startTransition] = React.useTransition();
  const [problem, setProblem] = React.useState<string | null>(null);

  const answer = (approve: boolean) => {
    startTransition(async () => {
      const [first] = await answerCaseReport({ ...props, approve });
      setProblem(first ?? null);
    });
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            answer(true);
          }}
        >
          <CheckIcon aria-hidden="true" />
          {t('review_yes')}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            answer(false);
          }}
        >
          <XIcon aria-hidden="true" />
          {t('review_no')}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-ink-muted">
          {t('review_refused')}
        </p>
      )}
    </div>
  );
}
