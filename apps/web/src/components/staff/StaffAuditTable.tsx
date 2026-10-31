'use client';

import { ClockCounterClockwiseIcon } from '@phosphor-icons/react';
import { useFormatter, useTranslations } from 'next-intl';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { StaffAuditItem } from '@/libs/accounts/StaffAudit';

function Heading(props: { id: 'when' | 'who' | 'action' | 'target' }) {
  const t = useTranslations('Staff');

  return t(`audit_col_${props.id}`);
}

function When(props: { value: string }) {
  const format = useFormatter();

  return format.dateTime(new Date(props.value), { dateStyle: 'medium', timeStyle: 'short' });
}

function Action(props: { value: StaffAuditItem['action']; via: StaffAuditItem['via'] }) {
  const t = useTranslations('Staff');

  return (
    <span className="flex flex-wrap items-center gap-2">
      {t(`audit_action_${props.value}`)}
      {props.via && <Badge variant="muted">{t('audit_via_assistant')}</Badge>}
    </span>
  );
}

const helper = createAppColumnHelper<StaffAuditItem>();

const columns = helper.columns([
  helper.accessor('at', {
    id: 'when',
    header: () => <Heading id="when" />,
    cell: ({ getValue }) => <When value={getValue()} />,
  }),
  helper.accessor('actor', { id: 'who', header: () => <Heading id="who" /> }),
  helper.accessor('action', {
    id: 'action',
    header: () => <Heading id="action" />,
    cell: ({ row }) => <Action value={row.original.action} via={row.original.via} />,
  }),
  helper.accessor((row) => row.target ?? '', {
    id: 'target',
    header: () => <Heading id="target" />,
    cell: ({ getValue }) => <span className="font-mono text-xs text-ink-muted">{getValue()}</span>,
  }),
]);

/**
 * The latest things staff did, newest first: who, what, to which thing and when. It is read-only.
 * @param props - The table props.
 * @param props.items - The recorded actions.
 * @returns The table.
 */
export function StaffAuditTable(props: { items: StaffAuditItem[] }) {
  const t = useTranslations('Staff');

  return (
    <DataTable
      columns={columns}
      data={props.items}
      getRowId={(row) => row.id}
      toolbar={false}
      pagination
      pageSize={10}
      empty={
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClockCounterClockwiseIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('audit_empty_title')}</EmptyTitle>
            <EmptyDescription>{t('audit_empty_text')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
