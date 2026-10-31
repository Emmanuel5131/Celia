'use client';

import { ShieldCheckIcon } from '@phosphor-icons/react';
import type { Column } from '@tanstack/react-table';
import { useFormatter, useTranslations } from 'next-intl';
import { DataTable } from '@/components/data-table/DataTable';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { createAppColumnHelper } from '@/components/data-table/table';
import type { TableFeatures } from '@/components/data-table/table';
import { ApplicationStatusBadge } from '@/components/staff/ApplicationStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import type { ApplicationInReview } from '@/libs/accounts/Applications';
import { Link } from '@/libs/I18nNavigation';
import { reviewChecks } from '@/utils/accounts/Institution';

function Heading<TValue>(props: {
  id: 'applicant' | 'kind' | 'status' | 'domain' | 'checks' | 'due';
  column: Column<TableFeatures, ApplicationInReview, TValue>;
}) {
  const t = useTranslations('Staff');

  return <DataTableColumnHeader column={props.column} title={t(`apps_col_${props.id}`)} />;
}

function Due(props: { item: ApplicationInReview }) {
  const t = useTranslations('Staff');
  const format = useFormatter();

  if (props.item.decidedAt !== null) {
    return (
      <span className="text-ink-muted">
        {format.dateTime(new Date(props.item.decidedAt), { dateStyle: 'medium' })}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ink-muted">
        {format.dateTime(new Date(props.item.dueAt), { dateStyle: 'medium' })}
      </span>
      {props.item.overdue && <Badge variant="solid">{t('app_overdue')}</Badge>}
      {props.item.readyBy !== null && <Badge variant="dashed">{t('app_ready')}</Badge>}
    </div>
  );
}

function ReviewButton(props: { item: ApplicationInReview }) {
  const t = useTranslations('Staff');

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/dashboard/staff/applications/${props.item.id}`}>
        {t(props.item.status === 'in_review' ? 'apps_review' : 'apps_view')}
      </Link>
    </Button>
  );
}

function KindLabel(props: { kind: ApplicationInReview['kind'] }) {
  const t = useTranslations('Staff');

  return t(`app_kind_${props.kind}`);
}

function DomainLabel(props: { domain: ApplicationInReview['domain'] }) {
  const t = useTranslations('Staff');

  return t(`app_domain_${props.domain}`);
}

const ticked = (item: ApplicationInReview) =>
  reviewChecks.filter((check) => item.checks[check] === true).length;

const helper = createAppColumnHelper<ApplicationInReview>();

const columns = helper.columns([
  helper.accessor((row) => `${row.organisation ?? ''} ${row.name} ${row.email}`, {
    id: 'applicant',
    header: ({ column }) => <Heading id="applicant" column={column} />,
    cell: ({ row }) => (
      <div className="grid">
        <span className="font-medium">{row.original.organisation ?? '—'}</span>
        <span className="text-xs text-ink-muted">
          {[row.original.name, row.original.email].filter(Boolean).join(' · ')}
        </span>
      </div>
    ),
  }),
  helper.accessor('kind', {
    id: 'kind',
    header: ({ column }) => <Heading id="kind" column={column} />,
    cell: ({ getValue }) => <KindLabel kind={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor('status', {
    id: 'status',
    header: ({ column }) => <Heading id="status" column={column} />,
    cell: ({ getValue }) => <ApplicationStatusBadge status={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor('domain', {
    id: 'domain',
    header: ({ column }) => <Heading id="domain" column={column} />,
    cell: ({ getValue }) => <DomainLabel domain={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor((row) => ticked(row), {
    id: 'checks',
    header: ({ column }) => <Heading id="checks" column={column} />,
    cell: ({ getValue }) => `${getValue()} / ${reviewChecks.length}`,
  }),
  helper.accessor('dueAt', {
    id: 'due',
    header: ({ column }) => <Heading id="due" column={column} />,
    cell: ({ row }) => <Due item={row.original} />,
  }),
  helper.display({
    id: 'review',
    header: () => null,
    cell: ({ row }) => <ReviewButton item={row.original} />,
    enableSorting: false,
    enableHiding: false,
  }),
]);

/**
 * Every application, as a table that sorts and filters: those waiting for review first, then the approved and rejected ones. Each
 * row links to its own page, where the applicant's details, the lookups, the six checks and the decision are shown in full.
 * @param props - The table props.
 * @param props.items - The applications.
 * @returns The table.
 */
export function ApplicationsTable(props: { items: ApplicationInReview[] }) {
  const t = useTranslations('Staff');

  return (
    <DataTable
      columns={columns}
      data={props.items}
      getRowId={(row) => row.id}
      pageSize={25}
      searchPlaceholder={t('apps_search')}
      labels={{
        applicant: t('apps_col_applicant'),
        kind: t('apps_col_kind'),
        status: t('apps_col_status'),
        domain: t('apps_col_domain'),
        checks: t('apps_col_checks'),
        due: t('apps_col_due'),
      }}
      filters={[
        {
          columnId: 'status',
          title: t('apps_col_status'),
          options: (['in_review', 'approved', 'rejected'] as const).map((value) => ({
            value,
            label: t(`app_status_${value}`),
          })),
        },
        {
          columnId: 'kind',
          title: t('apps_col_kind'),
          options: (['law_firm', 'investigative', 'other'] as const).map((value) => ({
            value,
            label: t(`app_kind_${value}`),
          })),
        },
        {
          columnId: 'domain',
          title: t('apps_col_domain'),
          options: (['own', 'free', 'different', 'unknown'] as const).map((value) => ({
            value,
            label: t(`app_domain_${value}`),
          })),
        },
      ]}
      empty={
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheckIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('queue_empty_title')}</EmptyTitle>
            <EmptyDescription>{t('queue_empty_text')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
