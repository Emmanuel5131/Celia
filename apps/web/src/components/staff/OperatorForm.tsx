'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { addCaseOperator, updateCaseOperator } from '@/app/[locale]/(auth)/dashboard/staff/actions';
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
import { operatorRoles } from '@/utils/cases/Operators';
import type { CaseOperator } from '@/utils/cases/Operators';

/**
 * The form that adds one person or group the claimants allege is behind a platform: a name, what they are alleged to do, the
 * jurisdiction they are linked to and notes with names and links. It records what is alleged. The server refuses words that
 * declare fraud.
 * @param props - The form props.
 * @param props.caseId - The case id.
 * @param props.index - The row's place in the list, when changing one that is already there.
 * @param props.operator - The row to change, instead of adding a new one.
 * @returns The form.
 */
export function OperatorForm(props: { caseId: string; index?: number; operator?: CaseOperator }) {
  const close = useCloseAddDialog();
  const t = useTranslations('Staff');
  const roles = useTranslations('Operators');
  const [errors, setErrors] = React.useState<string[]>([]);
  const { pending, startTransition, dialog } = useConfirmedTransition();
  const { operator } = props;
  const editing = props.index !== undefined && operator !== undefined;
  const [role, setRole] = React.useState<string>(editing ? (operator.role ?? '') : 'runs');

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        startTransition(async () => {
          const result = editing
            ? await updateCaseOperator(props.caseId, props.index ?? 0, data)
            : await addCaseOperator(props.caseId, data);
          setErrors(result);

          if (result.length === 0) {
            close();
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="operator-name">{t('operators_name_label')}</Label>
          <Input
            id="operator-name"
            name="name"
            maxLength={120}
            defaultValue={operator?.name}
            aria-invalid={errors.includes('operators') || errors.includes('words')}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="operator-role">{t('operators_role_label')}</Label>
          <Select name="role" value={role} onValueChange={setRole}>
            <SelectTrigger id="operator-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operatorRoles.map((option) => (
                <SelectItem key={option} value={option}>
                  {roles(`role_${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {role === 'other' && (
        <div className="grid gap-2">
          <Label htmlFor="operator-role-note">{t('operators_role_note_label')}</Label>
          <Input
            id="operator-role-note"
            name="roleNote"
            maxLength={80}
            defaultValue={operator?.roleNote ?? undefined}
            aria-invalid={errors.includes('role')}
          />
        </div>
      )}
      <JurisdictionPicker
        name="jurisdiction"
        label={t('operators_place_label')}
        placeholder={t('operators_place_placeholder')}
        defaultId={operator?.jurisdiction ?? undefined}
        invalid={errors.includes('jurisdictions')}
      />
      <div className="grid gap-2">
        <Label htmlFor="operator-notes">{t('operators_info_label')}</Label>
        <Textarea
          id="operator-notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={operator?.notes ?? undefined}
          aria-invalid={errors.includes('words')}
        />
      </div>
      {errors.length > 0 && (
        <p role="alert" className="text-sm text-seal">
          {errors.includes('words') && t('operators_error_words')}
          {errors.includes('operators') && t('operators_error_name')}
          {errors.includes('role') && t('operators_error_role')}
          {errors.includes('jurisdictions') && t('operators_error_places')}
        </p>
      )}
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {t(editing ? 'save' : 'operators_save')}
      </Button>
      {dialog}
    </form>
  );
}
