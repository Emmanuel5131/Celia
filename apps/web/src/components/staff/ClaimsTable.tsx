'use client';

import { SealCheckIcon } from '@phosphor-icons/react';
import type { Column } from '@tanstack/react-table';
import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import {
  rejectClaims,
  startClaimReviews,
  validateClaims,
} from '@/app/[locale]/(auth)/dashboard/staff/actions';
import type { BulkResult } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { ChainLabel } from '@/components/claims/ChainLabel';
import { useClaimLabels } from '@/components/claims/claim-labels';
import { ClaimStateBadge } from '@/components/claims/ClaimStateBadge';
import { DataTable } from '@/components/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { createSelectColumn } from '@/components/data-table/select-column';
import { createAppColumnHelper } from '@/components/data-table/table';
import type { TableFeatures } from '@/components/data-table/table';
import { BulkDecision } from '@/components/staff/BulkDecision';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { ClaimToValidate } from '@/libs/accounts/Staff';
import type { ClaimAgentReview } from '@/libs/claims/AgentReview';
import { Link } from '@/libs/I18nNavigation';

type ClaimRow = ClaimToValidate & { agentReview: ClaimAgentReview | null };

function Heading<TValue>(props: {
  id: 'platform' | 'state' | 'type' | 'chain' | 'amount' | 'flags' | 'assistant' | 'sent';
  column: Column<TableFeatures, ClaimRow, TValue>;
}) {
  const t = useTranslations('Staff');

  return <DataTableColumnHeader column={props.column} title={t(`claims_col_${props.id}`)} />;
}

function Flags(props: { item: ClaimRow }) {
  const t = useTranslations('Staff');

  if (props.item.signals.length === 0) {
    return <span className="text-ink-muted">—</span>;
  }

  return <Badge variant="dashed">{t('claims_flags', { count: props.item.signals.length })}</Badge>;
}

function Assistant(props: { review: ClaimAgentReview | null }) {
  const t = useTranslations('Staff');

  if (!props.review) {
    return <span className="text-ink-muted">—</span>;
  }

  return props.review.interesting ? (
    <Badge variant="solid">{t('claims_assistant_flagged')}</Badge>
  ) : (
    <Badge variant="dashed">{t('claims_assistant_reviewed')}</Badge>
  );
}

function assistantState(review: ClaimAgentReview | null) {
  if (!review) {
    return 'none';
  }

  return review.interesting ? 'flagged' : 'reviewed';
}

function FraudType(props: { value: ClaimToValidate['fraudType'] }) {
  const labels = useClaimLabels();

  return labels.fraudType[props.value];
}

function Sent(props: { value: string | null }) {
  const format = useFormatter();

  return props.value ? (
    <span className="text-ink-muted">
      {format.dateTime(new Date(props.value), { dateStyle: 'medium' })}
    </span>
  ) : null;
}

function ReviewButton(props: { id: string }) {
  const t = useTranslations('Staff');

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/dashboard/staff/claims/${props.id}`}>{t('claims_review')}</Link>
    </Button>
  );
}

function SignedBadge() {
  const t = useTranslations('ClaimList');

  return <Badge variant="solid">{t('wallet_signed')}</Badge>;
}

function ProofBadge() {
  const t = useTranslations('Staff');

  return <Badge variant="dashed">{t('claims_proof_added')}</Badge>;
}

const helper = createAppColumnHelper<ClaimRow>();

const columns = [
  createSelectColumn<ClaimRow>(),
  ...helper.columns([
    helper.accessor((row) => row.platformName ?? '', {
      id: 'platform',
      header: ({ column }) => <Heading id="platform" column={column} />,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.original.platformName ?? '—'}</span>
          {row.original.signed && <SignedBadge />}
          {row.original.proof && <ProofBadge />}
        </div>
      ),
    }),
    helper.accessor('state', {
      id: 'state',
      header: ({ column }) => <Heading id="state" column={column} />,
      cell: ({ getValue }) => <ClaimStateBadge state={getValue()} />,
      filterFn: 'inSet',
    }),
    helper.accessor('fraudType', {
      id: 'type',
      header: ({ column }) => <Heading id="type" column={column} />,
      cell: ({ getValue }) => <FraudType value={getValue()} />,
      filterFn: 'inSet',
    }),
    helper.accessor('chain', {
      id: 'chain',
      header: ({ column }) => <Heading id="chain" column={column} />,
      cell: ({ getValue }) => <ChainLabel chain={getValue()} />,
      filterFn: 'inSet',
    }),
    helper.accessor((row) => row.amountLost ?? '', {
      id: 'amount',
      header: ({ column }) => <Heading id="amount" column={column} />,
    }),
    helper.accessor((row) => (row.signals.length > 0 ? 'flagged' : 'clear'), {
      id: 'flags',
      header: ({ column }) => <Heading id="flags" column={column} />,
      cell: ({ row }) => <Flags item={row.original} />,
      filterFn: 'inSet',
    }),
    helper.accessor((row) => assistantState(row.agentReview), {
      id: 'assistant',
      header: ({ column }) => <Heading id="assistant" column={column} />,
      cell: ({ row }) => <Assistant review={row.original.agentReview} />,
      filterFn: 'inSet',
    }),
    helper.accessor('submittedAt', {
      id: 'sent',
      header: ({ column }) => <Heading id="sent" column={column} />,
      cell: ({ getValue }) => <Sent value={getValue()} />,
    }),
    helper.display({
      id: 'review',
      header: () => null,
      cell: ({ row }) => <ReviewButton id={row.original.id} />,
      enableSorting: false,
      enableHiding: false,
    }),
  ]),
];

/**
 * The sent claims waiting for staff, as a table that sorts, filters and selects. Select several and confirm them together, or
 * open one on its own page to see why it was flagged and any video or files the person added for the wallet. Accepting a claim
 * confirms its wallet proof with it; a reviewer can instead ask for new proof and keep the claim waiting. A claim another person
 * has already proved the wallet for cannot be confirmed; the server skips it and says how many it skipped.
 * @param props - The table props.
 * @param props.items - The claims waiting.
 * @param props.total - How many are waiting in all, which may be more than the table loaded.
 * @returns The table and the result of the last change.
 */
export function ClaimsTable(props: { items: ClaimRow[]; total: number }) {
  const t = useTranslations('Staff');
  const labels = useClaimLabels();
  const list = useTranslations('ClaimList');
  const [result, setResult] = React.useState<BulkResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  const types = [...new Set(props.items.map((item) => item.fraudType))];

  return (
    <div className="grid gap-4">
      {result && (
        <output className="text-sm">
          {t('bulk_result', { done: result.done, skipped: result.skipped })}
        </output>
      )}
      {props.total > props.items.length && (
        <p className="text-sm text-ink-muted">
          {t('queue_showing', {
            shown: props.items.length,
            total: props.total,
          })}
        </p>
      )}
      <DataTable
        columns={columns}
        data={props.items}
        getRowId={(row) => row.id}
        selectable
        pageSize={25}
        searchPlaceholder={t('claims_search')}
        labels={{
          platform: t('claims_col_platform'),
          state: t('claims_col_state'),
          type: t('claims_col_type'),
          chain: t('claims_col_chain'),
          amount: t('claims_col_amount'),
          flags: t('claims_col_flags'),
          assistant: t('claims_col_assistant'),
          sent: t('claims_col_sent'),
        }}
        filters={[
          {
            columnId: 'state',
            title: t('claims_col_state'),
            options: [
              { value: 'sent', label: list('state_sent') },
              { value: 'in_review', label: list('state_in_review') },
            ],
          },
          {
            columnId: 'flags',
            title: t('claims_col_flags'),
            options: [
              { value: 'flagged', label: t('claims_filter_flagged') },
              { value: 'clear', label: t('claims_filter_clear') },
            ],
          },
          {
            columnId: 'assistant',
            title: t('claims_col_assistant'),
            options: [
              { value: 'flagged', label: t('claims_assistant_flagged') },
              { value: 'reviewed', label: t('claims_assistant_reviewed') },
              { value: 'none', label: t('claims_assistant_none') },
            ],
          },
          {
            columnId: 'type',
            title: t('claims_col_type'),
            options: types.map((value) => ({
              value,
              label: labels.fraudType[value],
            })),
          },
        ]}
        selectionActions={(rows) => (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  setResult(await startClaimReviews(rows.map((row) => row.id)));
                });
              }}
            >
              {t('claims_bulk_start', { count: rows.length })}
            </Button>
            <BulkDecision
              defaultNote={t('claims_reject_default_note')}
              copy={{
                confirm: t('claims_bulk_accept', { count: rows.length }),
                decline: t('claims_bulk_reject', { count: rows.length }),
                confirmTitle: t('claims_accept_title', { count: rows.length }),
                confirmText: t('claims_accept_text'),
                declineTitle: t('claims_reject_title', { count: rows.length }),
                declineText: t('claims_reject_text'),
                confirmAction: t('claims_accept_action'),
                declineAction: t('claims_reject_action'),
              }}
              onSettle={async (decision, note) => {
                const ids = rows.map((row) => row.id);

                if (decision === 'confirm') {
                  setResult(await validateClaims(ids));

                  return null;
                }

                const outcome = await rejectClaims({ claimIds: ids, note });

                setResult(outcome);

                return outcome.error ?? null;
              }}
            />
          </>
        )}
        empty={
          <Empty className="border border-border bg-surface">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SealCheckIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t('validate_empty_title')}</EmptyTitle>
              <EmptyDescription>{t('validate_empty_text')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
    </div>
  );
}
