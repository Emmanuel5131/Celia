'use client';

import { PaperPlaneTiltIcon } from '@phosphor-icons/react';
import type { Column } from '@tanstack/react-table';
import { useFormatter, useTranslations } from 'next-intl';
import { DataTable } from '@/components/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { createAppColumnHelper } from '@/components/data-table/table';
import type { TableFeatures } from '@/components/data-table/table';
import { ContactRequestStatusBadge } from '@/components/staff/ContactRequestStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { listForStaff } from '@/libs/contact/ContactRequests';
import { Link } from '@/libs/I18nNavigation';
import { contactStatuses } from '@/utils/contact/ContactRequest';

type Row = Awaited<ReturnType<typeof listForStaff>>[number];

const waiting = (row: Row) => row.status === 'submitted' || row.status === 'agent_reviewed';

function Heading<TValue>(props: {
  id: 'org' | 'case' | 'purpose' | 'status' | 'sent';
  column: Column<TableFeatures, Row, TValue>;
}) {
  const t = useTranslations('Staff');

  return <DataTableColumnHeader column={props.column} title={t(`cr_col_${props.id}`)} />;
}

function Sent(props: { value: Row['submittedAt'] }) {
  const format = useFormatter();

  return props.value ? (
    <span className="text-ink-muted">{format.dateTime(props.value, { dateStyle: 'medium' })}</span>
  ) : null;
}

function Purpose(props: { value: Row['purpose'] }) {
  const t = useTranslations('Staff');

  return props.value ? t(`cr_purpose_${props.value}`) : null;
}

function OpenButton(props: { row: Row }) {
  const t = useTranslations('Staff');

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/dashboard/staff/contact-requests/${props.row.id}`}>
        {t(waiting(props.row) ? 'cr_review' : 'cr_view')}
      </Link>
    </Button>
  );
}

const helper = createAppColumnHelper<Row>();

const columns = helper.columns([
  helper.accessor((row) => `${row.organisation ?? ''} ${row.caseName}`, {
    id: 'org',
    header: ({ column }) => <Heading id="org" column={column} />,
    cell: ({ row }) => <span className="font-medium">{row.original.organisation ?? '—'}</span>,
  }),
  helper.accessor('caseName', {
    id: 'case',
    header: ({ column }) => <Heading id="case" column={column} />,
  }),
  helper.accessor('purpose', {
    id: 'purpose',
    header: ({ column }) => <Heading id="purpose" column={column} />,
    cell: ({ getValue }) => <Purpose value={getValue()} />,
  }),
  helper.accessor('status', {
    id: 'status',
    header: ({ column }) => <Heading id="status" column={column} />,
    cell: ({ getValue }) => <ContactRequestStatusBadge status={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor('submittedAt', {
    id: 'sent',
    header: ({ column }) => <Heading id="sent" column={column} />,
    cell: ({ getValue }) => <Sent value={getValue()} />,
  }),
  helper.display({
    id: 'open',
    header: () => null,
    cell: ({ row }) => <OpenButton row={row.original} />,
    enableSorting: false,
    enableHiding: false,
  }),
]);

/**
 * Every submitted request to contact the claimants of a case, as a table that sorts and filters: those waiting for a decision
 * first, then the decided ones. Each row opens the request, where the message and the rules are read and the decision is made.
 * @param props - The table props.
 * @param props.items - The requests.
 * @returns The table.
 */
export function ContactRequestsTable(props: { items: Row[] }) {
  const t = useTranslations('Staff');

  return (
    <DataTable
      columns={columns}
      data={props.items}
      getRowId={(row) => row.id}
      pageSize={25}
      searchPlaceholder={t('cr_search')}
      labels={{
        org: t('cr_col_org'),
        case: t('cr_col_case'),
        purpose: t('cr_col_purpose'),
        status: t('cr_col_status'),
        sent: t('cr_col_sent'),
      }}
      filters={[
        {
          columnId: 'status',
          title: t('cr_col_status'),
          options: contactStatuses
            .filter((value) => value !== 'draft')
            .map((value) => ({ value, label: t(`cr_status_${value}`) })),
        },
      ]}
      empty={
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PaperPlaneTiltIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('cr_empty_title')}</EmptyTitle>
            <EmptyDescription>{t('cr_empty_text')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
