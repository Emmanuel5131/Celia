'use client';

import type { ChainId, FraudType } from '@celia/core';
import { UsersThreeIcon } from '@phosphor-icons/react';
import { useFormatter, useTranslations } from 'next-intl';
import { ChainLabel, useChainName } from '@/components/claims/ChainLabel';
import { useClaimLabels } from '@/components/claims/claim-labels';
import { DataTable } from '@/components/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { createAppColumnHelper } from '@/components/data-table/table';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Link } from '@/libs/I18nNavigation';

/** One claim in a case, as the claimants table shows it. */
export type ClaimantRow = {
  id: string;
  caseId: string;
  /** The person's name, or a numbered label when we have none. */
  name: string;
  fraudType: FraudType;
  chain: ChainId;
  /** The wallet or the transaction. */
  reference: string;
  amountLost: string | null;
  country: string | null;
  ownership: string;
  submittedAt: string | null;
};

type ColumnId = 'claimant' | 'type' | 'chain' | 'amount' | 'country' | 'ownership' | 'submitted';

function Heading<TValue>(props: {
  column: Parameters<typeof DataTableColumnHeader<ClaimantRow, TValue>>[0]['column'];
  id: ColumnId;
}) {
  const t = useTranslations('CaseClaimants');

  return <DataTableColumnHeader column={props.column} title={t(`col_${props.id}`)} />;
}

function NameCell(props: { row: ClaimantRow }) {
  return (
    <Link
      href={`/dashboard/cases/${props.row.caseId}/claims/${props.row.id}`}
      className="grid gap-1 focus-ring hover:underline hover:underline-offset-4"
    >
      <span className="font-medium">{props.row.name}</span>
      <span className="font-mono text-xs text-ink-muted">
        {props.row.reference.slice(0, 8)}…{props.row.reference.slice(-6)}
      </span>
    </Link>
  );
}

function TypeCell(props: { value: FraudType }) {
  return useClaimLabels().fraudType[props.value];
}

function OwnershipCell(props: { value: string }) {
  const t = useTranslations('CaseClaimants');

  return props.value === 'signed' ? (
    <Badge variant="solid">{t('ownership_signed')}</Badge>
  ) : (
    <Badge variant="dashed">{t('ownership_unsigned')}</Badge>
  );
}

function DateCell(props: { value: string | null }) {
  const format = useFormatter();

  return props.value ? (
    <span className="text-ink-muted">
      {format.dateTime(new Date(props.value), { dateStyle: 'medium' })}
    </span>
  ) : null;
}

const helper = createAppColumnHelper<ClaimantRow>();

const columns = helper.columns([
  helper.accessor((row) => `${row.name} ${row.reference}`, {
    id: 'claimant',
    header: ({ column }) => <Heading column={column} id="claimant" />,
    cell: ({ row }) => <NameCell row={row.original} />,
  }),
  helper.accessor('fraudType', {
    id: 'type',
    header: ({ column }) => <Heading column={column} id="type" />,
    cell: ({ getValue }) => <TypeCell value={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor('chain', {
    id: 'chain',
    header: ({ column }) => <Heading column={column} id="chain" />,
    cell: ({ getValue }) => <ChainLabel chain={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor((row) => row.amountLost ?? '', {
    id: 'amount',
    header: ({ column }) => <Heading column={column} id="amount" />,
    cell: ({ getValue }) => getValue() || <span className="text-ink-muted">—</span>,
  }),
  helper.accessor((row) => row.country ?? '', {
    id: 'country',
    header: ({ column }) => <Heading column={column} id="country" />,
    cell: ({ getValue }) => getValue().toUpperCase() || <span className="text-ink-muted">—</span>,
  }),
  helper.accessor('ownership', {
    id: 'ownership',
    header: ({ column }) => <Heading column={column} id="ownership" />,
    cell: ({ getValue }) => <OwnershipCell value={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor((row) => row.submittedAt ?? '', {
    id: 'submitted',
    header: ({ column }) => <Heading column={column} id="submitted" />,
    cell: ({ getValue }) => <DateCell value={getValue() || null} />,
  }),
]);

/**
 * The claims in a case, one row per claim, each linking to its own page. Search, filters by type and chain, and sorting. Shown
 * only to Celia staff and the lawyer who leads the case.
 * @param props - The table props.
 * @param props.claims - The claims in the case.
 * @param props.preview - Show the rows alone, without search or paging, for a short look that links to the full list.
 * @returns The table, or the empty state.
 */
export function CaseClaimantsTable(props: { claims: ClaimantRow[]; preview?: boolean }) {
  const t = useTranslations('CaseClaimants');
  const claimLabels = useClaimLabels();
  const chainName = useChainName();
  const types = [...new Set(props.claims.map((claim) => claim.fraudType))];
  const chains = [...new Set(props.claims.map((claim) => claim.chain))];

  return (
    <DataTable
      toolbar={!props.preview}
      pagination={!props.preview}
      columns={columns}
      data={props.claims}
      getRowId={(row) => row.id}
      labels={{
        claimant: t('col_claimant'),
        type: t('col_type'),
        chain: t('col_chain'),
        amount: t('col_amount'),
        country: t('col_country'),
        ownership: t('col_ownership'),
        submitted: t('col_submitted'),
      }}
      searchPlaceholder={t('search_placeholder')}
      filters={[
        {
          columnId: 'type',
          title: t('col_type'),
          options: types.map((value) => ({ value, label: claimLabels.fraudType[value] })),
        },
        {
          columnId: 'chain',
          title: t('col_chain'),
          options: chains.map((value) => ({ value, label: chainName(value) })),
        },
      ]}
      pageSize={10}
      empty={
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersThreeIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('empty_title')}</EmptyTitle>
            <EmptyDescription>{t('empty_text')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
