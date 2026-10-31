'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * A list of a case opened over the case page, so staying on the overview costs nothing: closing it goes back to where you were.
 * It sits at the list's own address, so "Open as a page" (a full page load of that address), a refresh and a shared link all show
 * the list as a page.
 * @param props - The modal props.
 * @param props.title - The list's name.
 * @param props.description - One sentence on what the list holds.
 * @param props.children - The list.
 * @returns The modal.
 */
export function CaseListModal(props: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('CaseDetail');
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
          <Button asChild variant="outline" size="sm" className="justify-self-start">
            {/* A plain link on purpose: a soft navigation to this address would open the modal again. */}
            <a href={pathname}>{t('open_as_page')}</a>
          </Button>
        </DialogHeader>
        {props.children}
      </DialogContent>
    </Dialog>
  );
}
