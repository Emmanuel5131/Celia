'use client';

import { TrashIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { removePlatformStatement } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { ConfirmAction } from '@/components/staff/ConfirmAction';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/libs/I18nNavigation';

/**
 * Removes a statement nobody has researched yet, then goes back to the case's page, where the statement was listed.
 * @param props - The button props.
 * @param props.caseId - The case id.
 * @param props.statementId - The statement to remove.
 * @returns The button.
 */
export function RemoveStatementButton(props: { caseId: string; statementId: string }) {
  const t = useTranslations('Staff');
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" disabled={pending}>
          <TrashIcon aria-hidden="true" />
          {t('statements_remove')}
        </Button>
      }
      title={t('confirm_remove_title')}
      description={t('confirm_remove_statement')}
      confirmLabel={t('statements_remove')}
      pending={pending}
      onConfirm={() => {
        startTransition(async () => {
          await removePlatformStatement(props.caseId, props.statementId);
          router.push(`/dashboard/staff/cases/${props.caseId}`);
        });
      }}
    />
  );
}
