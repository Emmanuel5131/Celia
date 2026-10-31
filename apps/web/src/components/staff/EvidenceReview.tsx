'use client';

import { evidenceReviewStates } from '@celia/core';
import type { EvidenceReviewState } from '@celia/core';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { reviewCaseEvidence } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { useCloseAddDialog } from '@/components/staff/AddDialog';
import { useConfirmedTransition } from '@/components/staff/ConfirmAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CaseEvidence } from '@/libs/analysis/Evidence';

/**
 * Where staff have got to with a piece of off-chain evidence, as a small badge.
 * @param props - The badge props.
 * @param props.state - The review state.
 * @returns The badge.
 */
export function ReviewBadge(props: { state: EvidenceReviewState }) {
  const t = useTranslations('Staff');

  return (
    <Badge variant={props.state === 'not_reviewed' ? 'dashed' : 'muted'}>
      {t(`evidence_review_${props.state}`)}
    </Badge>
  );
}

/**
 * The form staff use to review one piece of off-chain evidence: pick where it stands and write what was found. The report never
 * says the evidence proves anything, so the note describes what it shows.
 * @param props - The form props.
 * @param props.caseId - The case id.
 * @param props.item - The evidence being reviewed.
 * @returns The form.
 */
export function EvidenceReviewForm(props: { caseId: string; item: CaseEvidence }) {
  const close = useCloseAddDialog();
  const t = useTranslations('Staff');
  const [errors, setErrors] = React.useState<string[]>([]);
  const { pending, startTransition, dialog } = useConfirmedTransition();
  const { item } = props;

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        startTransition(async () => {
          const result = await reviewCaseEvidence(props.caseId, item.id, data);
          setErrors(result);

          if (result.length === 0) {
            close();
          }
        });
      }}
    >
      <p className="text-sm font-medium">{item.title}</p>
      <div className="grid gap-2">
        <Label htmlFor={`review-state-${item.id}`}>{t('evidence_review_state_label')}</Label>
        <Select name="state" defaultValue={item.reviewState}>
          <SelectTrigger id={`review-state-${item.id}`} aria-invalid={errors.includes('invalid')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {evidenceReviewStates.map((state) => (
              <SelectItem key={state} value={state}>
                {t(`evidence_review_${state}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`review-note-${item.id}`}>{t('evidence_review_note_label')}</Label>
        <Textarea
          id={`review-note-${item.id}`}
          name="note"
          rows={4}
          maxLength={500}
          defaultValue={item.reviewNote ?? undefined}
          aria-invalid={errors.includes('words')}
        />
      </div>
      {errors.length > 0 && (
        <p role="alert" className="text-sm text-seal">
          {errors.includes('words') ? t('evidence_error_words') : t('evidence_review_error')}
        </p>
      )}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>
        {t('evidence_review_save')}
      </Button>
      {dialog}
    </form>
  );
}
