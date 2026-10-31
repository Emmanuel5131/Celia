'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { setCaseStatus } from '@/app/[locale]/(auth)/dashboard/staff/actions';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { caseStatuses } from '@/utils/cases/Case';
import type { CaseStatus } from '@/utils/cases/Case';

/**
 * The stage of a case, which only staff move: collecting claims, building evidence, or sealed (enough evidence). Moving a sealed
 * case back to building lets it be analysed again. Sealing needs a report, because it says the evidence file is finished.
 * @param props - The select props.
 * @param props.id - The case id.
 * @param props.status - The case's stage now.
 * @param props.hasReport - Whether the case has a saved report, which sealing needs.
 * @returns The select.
 */
export function CaseStage(props: { id: string; status: CaseStatus; hasReport: boolean }) {
  const t = useTranslations('CaseBank');
  const staff = useTranslations('Staff');
  const common = useTranslations('Common');
  const [pending, startTransition] = React.useTransition();

  const [next, setNext] = React.useState<CaseStatus | null>(null);
  const moving = next ?? props.status;
  const sealing = moving === 'sealed';
  const unsealing = props.status === 'sealed' && next !== null;
  let warning: 'confirm_stage_sealed' | 'confirm_stage_unsealed' | 'confirm_stage_other' =
    'confirm_stage_other';

  if (sealing) {
    warning = 'confirm_stage_sealed';
  } else if (unsealing) {
    warning = 'confirm_stage_unsealed';
  }

  return (
    <>
      <Select
        value={props.status}
        disabled={pending}
        onValueChange={(value) => {
          setNext(caseStatuses.find((status) => status === value) ?? null);
        }}
      >
        <SelectTrigger size="sm" className="w-48" aria-label={t('col_status')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {caseStatuses.map((status) => (
            <SelectItem
              key={status}
              value={status}
              disabled={status === 'sealed' && !props.hasReport}
            >
              {t(`status_${status}`)}
              {status === 'sealed' && !props.hasReport ? ` · ${staff('needs_report')}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AlertDialog
        open={next !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNext(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {staff('confirm_stage_title', { stage: t(`status_${moving}`) })}
            </AlertDialogTitle>
            <AlertDialogDescription>{staff(warning)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{common('cancel')}</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={() => {
                const status = next;
                setNext(null);

                if (status) {
                  startTransition(async () => {
                    await setCaseStatus(props.id, status);
                  });
                }
              }}
            >
              {staff('confirm_stage_action')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
