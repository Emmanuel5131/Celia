'use client';

import { PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const OpenContext = React.createContext<(open: boolean) => void>(() => null);

/**
 * Gives a form inside an add dialog the way to close it once its row is saved.
 * @returns The function that closes the dialog.
 */
export function useCloseAddDialog() {
  const setOpen = React.useContext(OpenContext);

  return () => {
    setOpen(false);
  };
}

/**
 * The "Add" button above a table, and the dialog it opens with the form for one new row. The form closes the dialog when the row
 * is saved, by calling the function from `useCloseAddDialog`.
 * @param props - The dialog props.
 * @param props.label - The button's words; for an edit, the name read out for the pencil button.
 * @param props.edit - Show a small pencil button instead of the Add button, for changing a row that is already there.
 * @param props.title - The dialog heading.
 * @param props.description - One sentence under the heading.
 * @param props.children - The form.
 * @returns The button and its dialog.
 */
export function AddDialog(props: {
  label: string;
  edit?: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.edit ? (
          <Button size="icon-sm" variant="outline" aria-label={props.label}>
            <PencilSimpleIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon aria-hidden="true" />
            {props.label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <OpenContext value={setOpen}>{props.children}</OpenContext>
      </DialogContent>
    </Dialog>
  );
}
