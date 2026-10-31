'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { addCaseAction, updateCaseAction } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { JurisdictionPicker } from '@/components/onboarding/JurisdictionPicker';
import { useCloseAddDialog } from '@/components/staff/AddDialog';
import { useConfirmedTransition } from '@/components/staff/ConfirmAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { actionKindPresets, isActionKindPreset } from '@/utils/cases/Actions';
import type { ActionRow } from '@/utils/cases/Actions';

function OwnKind(props: { action?: ActionRow; invalid: boolean }) {
  const t = useTranslations('Staff');
  const kind = props.action?.kind;

  return (
    <div className="grid gap-2">
      <Label htmlFor="action-kind-own">{t('actions_kind_own_label')}</Label>
      <Input
        id="action-kind-own"
        name="kindOwn"
        maxLength={80}
        placeholder={t('actions_kind_placeholder')}
        defaultValue={kind && !isActionKindPreset(kind) ? kind : undefined}
        aria-invalid={props.invalid}
      />
    </div>
  );
}

// A kind that is a preset is chosen by its key; any other words are the staff member's own, so the choice is "own".
function kindChoice(kind: string | null | undefined) {
  if (!kind) {
    return '';
  }

  return isActionKindPreset(kind) ? kind : 'own';
}

/**
 * The form that adds one alleged action: what was done, its kind, when and where, and notes. Evidence is attached to it from the
 * evidence form. It records what is alleged. The server refuses words that declare fraud.
 * @param props - The form props.
 * @param props.caseId - The case id.
 * @param props.action - An action to change, instead of adding a new one.
 * @returns The form.
 */
export function ActionForm(props: { caseId: string; action?: ActionRow }) {
  const close = useCloseAddDialog();
  const t = useTranslations('Staff');
  const [errors, setErrors] = React.useState<string[]>([]);
  const kinds = useTranslations('Actions');
  const { action } = props;
  const [choice, setChoice] = React.useState(kindChoice(action?.kind));
  const { pending, startTransition, dialog } = useConfirmedTransition();

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const entry = data.get('kindOwn');
        const own = typeof entry === 'string' ? entry.trim() : '';

        // A preset goes in by its key; "something else" goes in as the words typed for it.
        if (choice === 'own' && own === '') {
          setErrors(['kind']);

          return;
        }

        data.set('kind', choice === 'own' ? own : choice);
        data.delete('kindOwn');

        startTransition(async () => {
          const result = action
            ? await updateCaseAction(props.caseId, action.id, data)
            : await addCaseAction(props.caseId, data);
          setErrors(result);

          if (result.length === 0) {
            close();
          }
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="action-title">{t('actions_title_label')}</Label>
        <Input
          id="action-title"
          name="title"
          maxLength={200}
          defaultValue={action?.title}
          aria-invalid={errors.includes('invalid') || errors.includes('words')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="action-kind">{t('actions_kind_label')}</Label>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="action-kind" aria-invalid={errors.includes('kind')}>
              <SelectValue placeholder={t('actions_kind_choose')} />
            </SelectTrigger>
            <SelectContent>
              {actionKindPresets.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {kinds(`kind_${preset}`)}
                </SelectItem>
              ))}
              <SelectItem value="own">{t('actions_kind_own')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="action-date">{t('actions_date_label')}</Label>
          <Input
            id="action-date"
            name="occurredOn"
            type="date"
            defaultValue={action?.occurredOn ?? undefined}
          />
        </div>
      </div>
      {choice === 'own' && (
        <OwnKind action={action} invalid={errors.includes('kind') || errors.includes('words')} />
      )}
      <JurisdictionPicker
        name="jurisdiction"
        label={t('operators_place_label')}
        placeholder={t('operators_place_placeholder')}
        defaultId={action?.jurisdiction ?? undefined}
        invalid={errors.includes('jurisdictions')}
      />
      <div className="grid gap-2">
        <Label htmlFor="action-note">{t('operators_notes_label')}</Label>
        <Textarea
          id="action-note"
          name="note"
          rows={3}
          maxLength={1000}
          defaultValue={action?.note ?? undefined}
          aria-invalid={errors.includes('words')}
        />
      </div>
      {errors.length > 0 && (
        <p role="alert" className="text-sm text-seal">
          {errors.includes('words') && t('operators_error_words')}
          {errors.includes('invalid') && t('actions_error_invalid')}
          {errors.includes('kind') && t('actions_error_kind')}
          {errors.includes('jurisdictions') && t('operators_error_places')}
        </p>
      )}
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {t(action ? 'save' : 'actions_save')}
      </Button>
      {dialog}
    </form>
  );
}
