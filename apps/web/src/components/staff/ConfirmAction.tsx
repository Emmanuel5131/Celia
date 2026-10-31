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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * Asks before a change is made. The trigger opens a dialog that says what will happen; nothing changes until the confirm button
 * is pressed. Used for every change of state and every removal, because none of them can be taken back with one click.
 * @param props - The confirm props.
 * @param props.trigger - The button that starts the change; leave it out when the dialog is opened with `open`.
 * @param props.open - Opens the dialog from outside, instead of a trigger.
 * @param props.onOpenChange - Called when the dialog asks to open or close, for use with `open`.
 * @param props.title - The question.
 * @param props.description - What will happen.
 * @param props.confirmLabel - The words on the confirm button.
 * @param props.pending - Whether the change is running, which disables both buttons.
 * @param props.onConfirm - Makes the change.
 * @returns The trigger and its dialog.
 */
export function ConfirmAction(props: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations('Common');
  const [inner, setInner] = React.useState(false);
  const open = props.open ?? inner;
  const setOpen = props.onOpenChange ?? setInner;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {props.trigger && <AlertDialogTrigger asChild>{props.trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.pending}>{t('cancel')}</AlertDialogCancel>
          <Button
            disabled={props.pending}
            onClick={() => {
              props.onConfirm();
              setOpen(false);
            }}
          >
            {props.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A transition that asks first. Calling the function it returns opens a dialog; the change runs only when the staff member
 * confirms, and not at all if they cancel. It stands in for `React.useTransition` in the forms that edit a case, so the form's own
 * handler stays as it is. Render the `dialog` it returns inside the form.
 * @returns Whether the change is running, the function that asks and then runs it, and the dialog.
 */
export function useConfirmedTransition() {
  const t = useTranslations('Staff');
  const [pending, startReact] = React.useTransition();
  const [waiting, setWaiting] = React.useState<(() => Promise<void>) | null>(null);

  const dialog = (
    <ConfirmAction
      open={waiting !== null}
      onOpenChange={(open) => {
        if (!open) {
          setWaiting(null);
        }
      }}
      title={t('confirm_edit_title')}
      description={t('confirm_edit_text')}
      confirmLabel={t('confirm_edit_action')}
      pending={pending}
      onConfirm={() => {
        const change = waiting;
        setWaiting(null);

        if (change) {
          startReact(change);
        }
      }}
    />
  );

  return {
    pending,
    dialog,
    startTransition: (change: () => Promise<void>) => {
      setWaiting(() => change);
    },
  };
}
