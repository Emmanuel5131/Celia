'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { addCaseAction, addCaseOperator } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { useConfirmedTransition } from '@/components/staff/ConfirmAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * A one-line way to add a row to a list with just text: an alleged action gets the words as what was done, an alleged actor gets
 * them as its name. Everything else can be added later with the detailed form. The server refuses words that declare fraud.
 * @param props - The quick add props.
 * @param props.caseId - The case id.
 * @param props.list - Which list the row goes in.
 * @returns The input and its button.
 */
export function QuickAdd(props: { caseId: string; list: 'action' | 'actor' }) {
  const t = useTranslations('Staff');
  const [errors, setErrors] = React.useState<string[]>([]);
  const { pending, startTransition, dialog } = useConfirmedTransition();
  const field = props.list === 'action' ? 'title' : 'name';

  return (
    <form
      className="grid gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);

        startTransition(async () => {
          const result =
            props.list === 'action'
              ? await addCaseAction(props.caseId, data)
              : await addCaseOperator(props.caseId, data);
          setErrors(result);

          if (result.length === 0) {
            form.reset();
          }
        });
      }}
    >
      <div className="flex gap-2">
        <Input
          name={field}
          maxLength={props.list === 'action' ? 200 : 120}
          placeholder={t(
            props.list === 'action' ? 'quick_action_placeholder' : 'quick_actor_placeholder',
          )}
          aria-label={t(
            props.list === 'action' ? 'quick_action_placeholder' : 'quick_actor_placeholder',
          )}
          aria-invalid={errors.length > 0}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {t('quick_add')}
        </Button>
      </div>
      {errors.length > 0 && (
        <p role="alert" className="text-sm text-seal">
          {t(errors.includes('words') ? 'operators_error_words' : 'quick_error')}
        </p>
      )}
      {dialog}
    </form>
  );
}
