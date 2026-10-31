'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import {
  declineWalletProof,
  rejectClaims,
  startClaimReviews,
  validateClaims,
} from '@/app/[locale]/(auth)/dashboard/staff/actions';
import type { BulkResult } from '@/app/[locale]/(auth)/dashboard/staff/actions';
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
import type { ClaimRecord } from '@/libs/claims/StaffClaims';
import { useRouter } from '@/libs/I18nNavigation';

type Action = 'start' | 'accept' | 'reject' | 'proof';

function ReasonField(props: {
  id: string;
  value: string;
  missing: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('Staff');

  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{t('claims_reject_reason')}</Label>
      <Textarea
        id={props.id}
        rows={3}
        value={props.value}
        aria-invalid={props.missing}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
      {props.missing && (
        <p role="alert" className="text-seal">
          {t('review_reason_required')}
        </p>
      )}
    </div>
  );
}

function ConfirmDialog(props: {
  asking: 'accept' | 'reverse' | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('Staff');
  const reversing = props.asking === 'reverse';

  return (
    <AlertDialog
      open={props.asking !== null}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {reversing ? t('claim_reverse_title') : t('claim_accept_title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reversing ? t('claim_reverse_text') : t('claim_accept_text')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.pending}>{t('bulk_cancel')}</AlertDialogCancel>
          <Button disabled={props.pending} onClick={props.onConfirm}>
            {reversing ? t('claims_reject') : t('validate')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The staff decision on one claim, under its full details: start the review, accept, reject, or ask for new proof of the wallet.
 * Accepting asks first. An accepted claim can still be rejected, and a rejected one accepted, in case the first decision was a
 * mistake; both ask first. A claim another person has already proved the wallet for cannot be accepted. Starting a review or
 * asking for new proof keeps the claim here; accepting or rejecting it sends staff back to the list.
 * @param props - The review props.
 * @param props.record - The claim, in any state after it was sent.
 * @returns The reason field, the buttons and the result of the last change.
 */
export function ClaimReview(props: { record: ClaimRecord }) {
  const t = useTranslations('Staff');
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [reason, setReason] = React.useState('');
  const [missing, setMissing] = React.useState(false);
  const [result, setResult] = React.useState<BulkResult | null>(null);
  const [asking, setAsking] = React.useState<'accept' | 'reverse' | null>(null);
  const { record } = props;
  const blocked = !record.signed && record.signals.includes('wallet_signed_elsewhere');
  const accepted = record.state === 'accepted';
  const proofWaiting = record.reviewRequestedAt !== null && record.reviewedAt === null;

  const settle = (action: Action) => {
    if ((action === 'reject' || action === 'proof') && reason.trim() === '') {
      setMissing(true);

      return;
    }

    setMissing(false);
    setAsking(null);
    startTransition(async () => {
      if (action === 'start') {
        setResult(await startClaimReviews([record.id]));
      } else if (action === 'accept') {
        setResult(await validateClaims([record.id]));
      } else if (action === 'proof') {
        setResult(await declineWalletProof({ claimId: record.id, note: reason }));
      } else {
        setResult(await rejectClaims({ claimIds: [record.id], note: reason }));
      }

      if (action === 'accept' || action === 'reject') {
        router.push('/dashboard/staff/claims');
      } else {
        router.refresh();
      }
    });
  };

  const waiting = record.state === 'sent' || record.state === 'in_review';
  const rejected = record.state === 'rejected';
  const reversing = asking === 'reverse';

  return (
    <section className="grid gap-4 border-t border-line-soft pt-4" aria-label={t('claims_review')}>
      {blocked && !accepted && <p className="text-seal">{t('validate_blocked')}</p>}
      {accepted && <p className="text-ink-muted">{t('claim_accepted_note')}</p>}
      {rejected && <p className="text-ink-muted">{t('claim_rejected_note')}</p>}
      {!rejected && (
        <ReasonField
          id={`reject-${record.id}`}
          value={reason}
          missing={missing}
          onChange={setReason}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {record.state === 'sent' && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              settle('start');
            }}
          >
            {t('claims_start_review')}
          </Button>
        )}
        {(waiting || rejected) && (
          <Button
            disabled={pending || blocked}
            onClick={() => {
              setAsking('accept');
            }}
          >
            {t('validate')}
          </Button>
        )}
        {(waiting || accepted) && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (accepted) {
                if (reason.trim() === '') {
                  setMissing(true);

                  return;
                }

                setMissing(false);
                setAsking('reverse');
              } else {
                settle('reject');
              }
            }}
          >
            {t('claims_reject')}
          </Button>
        )}
        {waiting && proofWaiting && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              settle('proof');
            }}
          >
            {t('claims_proof_decline')}
          </Button>
        )}
      </div>
      {result && (
        <output className="text-sm">
          {t('bulk_result', { done: result.done, skipped: result.skipped })}
        </output>
      )}
      <ConfirmDialog
        asking={asking}
        pending={pending}
        onClose={() => {
          setAsking(null);
        }}
        onConfirm={() => {
          settle(reversing ? 'reject' : 'accept');
        }}
      />
    </section>
  );
}
