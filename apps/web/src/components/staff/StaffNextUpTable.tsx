'use client';

import { CheckCircleIcon } from '@phosphor-icons/react';
import { useFormatter, useTranslations } from 'next-intl';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { NextUpItem } from '@/libs/accounts/StaffCounts';
import { Link } from '@/libs/I18nNavigation';

function Heading(props: { id: 'type' | 'detail' | 'waiting' }) {
  const t = useTranslations('Staff');

  return t(`next_col_${props.id}`);
}

function Kind(props: { value: NextUpItem['kind'] }) {
  const t = useTranslations('Staff');

  return t(`next_kind_${props.value}`);
}

function Waiting(props: { value: string }) {
  const format = useFormatter();

  return <span className="text-ink-muted">{format.relativeTime(new Date(props.value))}</span>;
}

function ReviewButton(props: { href: string }) {
  const t = useTranslations('Staff');

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={props.href}>{t('next_review')}</Link>
    </Button>
  );
}

const helper = createAppColumnHelper<NextUpItem>();

const columns = helper.columns([
  helper.accessor('kind', {
    id: 'type',
    header: () => <Heading id="type" />,
    cell: ({ getValue }) => <Kind value={getValue()} />,
  }),
  helper.accessor('detail', {
    id: 'detail',
    header: () => <Heading id="detail" />,
    cell: ({ getValue }) => getValue() || '—',
  }),
  helper.accessor('since', {
    id: 'waiting',
    header: () => <Heading id="waiting" />,
    cell: ({ getValue }) => <Waiting value={getValue()} />,
  }),
  helper.display({
    id: 'review',
    header: () => null,
    cell: ({ row }) => <ReviewButton href={row.original.href} />,
    enableSorting: false,
    enableHiding: false,
  }),
]);

/**
 * The items that have waited longest across the staff queues, oldest first, each with a way to open its queue. It is the work
 * list under the overview cards, so the page says what to do next and not only how much there is.
 * @param props - The table props.
 * @param props.items - The items, oldest first.
 * @returns The table, or an empty state when nothing is waiting.
 */
export function StaffNextUpTable(props: { items: NextUpItem[] }) {
  const t = useTranslations('Staff');

  return (
    <DataTable
      columns={columns}
      data={props.items}
      getRowId={(row) => `${row.kind}-${row.id}`}
      toolbar={false}
      pagination={false}
      empty={
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircleIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('next_empty_title')}</EmptyTitle>
            <EmptyDescription>{t('next_empty_text')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
