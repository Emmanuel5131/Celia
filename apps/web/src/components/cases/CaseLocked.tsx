'use client';

import { LockIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { ContactClaimantsDialog } from '@/components/cases/ContactClaimantsDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useRouter } from '@/libs/I18nNavigation';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';

type Locked = Exclude<CaseAccess, 'full'>;

function LockedMessage(props: { reason: Locked }) {
  const t = useTranslations('CaseDetail');

  return (
    <DialogHeader>
      <DialogTitle>{t('locked_title')}</DialogTitle>
      <DialogDescription>{t(`locked_${props.reason}`)}</DialogDescription>
    </DialogHeader>
  );
}

/**
 * Stands in for "View all" when the reader may only see the first rows of a list. It looks the same, with a lock, and opens a
 * message about verifying the organisation instead of the page with every row.
 * @param props - The button props.
 * @param props.reason - Why the list is limited: `unverified` or `person`.
 * @param props.count - How many rows the full list holds.
 * @returns The button and its message.
 */
export function LockedViewAll(props: { reason: Locked; count: number }) {
  const t = useTranslations('CaseDetail');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LockIcon aria-hidden="true" />
          {t('view_all', { count: props.count })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <LockedMessage reason={props.reason} />
        <DialogFooter>
          <Button>{t('locked_close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What a full list's page shows to a reader who may only see the first rows: the message, open at once, and a way back to the case.
 * The list itself is never read for them, so there is nothing behind the message.
 * @param props - The message props.
 * @param props.reason - Why the list is limited: `unverified` or `person`.
 * @param props.caseHref - The case's page, where closing the message goes.
 * @returns The message.
 */
export function LockedList(props: { reason: Locked; caseHref: string }) {
  const t = useTranslations('CaseDetail');
  const router = useRouter();

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          router.push(props.caseHref);
        }
      }}
    >
      <DialogContent>
        <LockedMessage reason={props.reason} />
        <DialogFooter>
          <Button
            onClick={() => {
              router.push(props.caseHref);
            }}
          >
            {t('locked_back')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A large box near the top of a case for readers who may not see all of it: it says what verified organisations get, including
 * reaching the claimants, and opens the message about verifying. It gives no count of what is hidden.
 * @param props - The box props.
 * @param props.access - How much of the case the reader may see. Verified organisations get the request form; everyone else a
 * message about getting access.
 * @param props.caseId - The case, which a request is about.
 * @returns The box.
 */
export function ContactClaimantsBox(props: { access: CaseAccess; caseId: string }) {
  const t = useTranslations('CaseDetail');
  return (
    <Card variant="outline">
      <CardContent className="grid gap-6 py-8 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-2">
          <h2 className="text-2xl font-bold">{t('contact_title')}</h2>
          <p className="max-w-prose text-ink-muted">
            {t(props.access === 'full' ? 'contact_text_full' : 'contact_text')}
          </p>
        </div>
        {props.access === 'full' ? (
          <ContactClaimantsDialog caseId={props.caseId} />
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg">
                <LockIcon aria-hidden="true" />
                {t('contact_action')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <LockedMessage reason={props.access} />
              <DialogFooter>
                <Button>{t('locked_close')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
