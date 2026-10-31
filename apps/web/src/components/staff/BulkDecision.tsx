'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * The actions for a selection of rows in a review table: confirm them all, or decline them all with one reason. Both ask first,
 * saying how many are affected, because a selection is easy to make larger than meant. The decline needs a reason, which each
 * person sees; it can start filled in with a default one.
 * @param props - The actions props.
 * @param props.copy - The words for the buttons and the dialogs, so wallets and claims each say it in their own terms.
 * @param props.onSettle - Applies the decision to the selection; it resolves to an error name when the server refused.
 * @returns The two buttons and their dialog.
 */
export function BulkDecision(props: {
  copy: {
    confirm: string;
    decline: string;
    confirmTitle: string;
    confirmText: string;
    declineTitle: string;
    declineText: string;
    confirmAction: string;
    declineAction: string;
  };
  /** The reason the decline starts with, so a common one is a single click. */
  defaultNote?: string;
  onSettle: (decision: 'confirm' | 'decline', note: string) => Promise<string | null>;
}) {
  const t = useTranslations('Staff');
  const { copy } = props;
  const [asking, setAsking] = React.useState<'confirm' | 'decline' | null>(null);
  const [note, setNote] = React.useState(props.defaultNote ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const apply = () => {
    if (!asking) {
      return;
    }

    if (asking === 'decline' && note.trim() === '') {
      setError('note');

      return;
    }

    startTransition(async () => {
      const refused = await props.onSettle(asking, note);

      setError(refused);

      if (!refused) {
        setAsking(null);
        setNote(props.defaultNote ?? '');
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setAsking('confirm');
        }}
      >
        {copy.confirm}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setAsking('decline');
        }}
      >
        {copy.decline}
      </Button>
      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAsking(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {asking === 'decline' ? copy.declineTitle : copy.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {asking === 'decline' ? copy.declineText : copy.confirmText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {asking === 'decline' && (
            <div className="grid gap-2">
              <Label htmlFor="bulk-note">{t('review_reason')}</Label>
              <Textarea
                id="bulk-note"
                rows={3}
                value={note}
                aria-invalid={error === 'note'}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
              {error === 'note' && (
                <p role="alert" className="text-sm text-seal">
                  {t('review_reason_required')}
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('bulk_cancel')}</AlertDialogCancel>
            <Button disabled={pending} onClick={apply}>
              {asking === 'decline' ? copy.declineAction : copy.confirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
