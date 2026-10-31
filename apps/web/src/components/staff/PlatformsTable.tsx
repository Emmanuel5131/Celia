'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import type { PlatformRow } from '@/libs/claims/StaffPlatforms';
import { Link } from '@/libs/I18nNavigation';

function Heading(props: { id: 'name' | 'claims' | 'confirmed' | 'chains' | 'latest' | 'case' }) {
  const t = useTranslations('StaffClaims');

  return t(`platforms_col_${props.id}`);
}

function Operator(props: { row: PlatformRow }) {
  const t = useTranslations('StaffClaims');

  return (
    <div className="grid gap-1">
      <span className="font-medium">{props.row.name}</span>
      <span className="text-xs text-ink-muted">
        {[props.row.host ?? t('platforms_no_website'), props.row.handle]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
  );
}

function Latest(props: { value: string | null }) {
  const format = useFormatter();

  return props.value ? (
    <span className="text-ink-muted">
      {format.dateTime(new Date(props.value), { dateStyle: 'medium' })}
    </span>
  ) : null;
}

function CaseCell(props: { row: PlatformRow }) {
  const t = useTranslations('StaffClaims');
  const { row } = props;

  return row.caseId && row.caseNumber ? (
    <Button asChild size="sm" variant="outline">
      <Link href={`/dashboard/staff/cases/${row.caseId}`}>{row.caseNumber}</Link>
    </Button>
  ) : (
    <Badge variant="dashed">{t('platforms_no_case')}</Badge>
  );
}

function ClaimsButton(props: { row: PlatformRow }) {
  const t = useTranslations('StaffClaims');

  return (
    <Button asChild size="sm" variant="outline">
      <Link
        href={{
          pathname: '/dashboard/staff/claims',
          query: { view: 'all', q: props.row.name },
        }}
      >
        {t('platforms_view_claims')}
      </Link>
    </Button>
  );
}

const helper = createAppColumnHelper<PlatformRow>();

const columns = helper.columns([
  helper.accessor((row) => `${row.name} ${row.host ?? ''} ${row.handle ?? ''}`, {
    id: 'name',
    header: () => <Heading id="name" />,
    cell: ({ row }) => <Operator row={row.original} />,
  }),
  helper.accessor('claims', {
    id: 'claims',
    header: () => <Heading id="claims" />,
  }),
  helper.accessor('confirmed', {
    id: 'confirmed',
    header: () => <Heading id="confirmed" />,
  }),
  helper.accessor((row) => row.chains.join(', '), {
    id: 'chains',
    header: () => <Heading id="chains" />,
    cell: ({ getValue }) => <span className="text-ink-muted capitalize">{getValue()}</span>,
    enableSorting: false,
  }),
  helper.accessor('lastAt', {
    id: 'latest',
    header: () => <Heading id="latest" />,
    cell: ({ getValue }) => <Latest value={getValue()} />,
  }),
  helper.display({
    id: 'case',
    header: () => <Heading id="case" />,
    cell: ({ row }) => <CaseCell row={row.original} />,
    enableSorting: false,
  }),
  helper.display({
    id: 'claims_link',
    header: () => null,
    cell: ({ row }) => <ClaimsButton row={row.original} />,
    enableSorting: false,
    enableHiding: false,
  }),
]);

/**
 * The claims grouped by who they name: a platform, a project or a single person. Each row gives the counts, the chains, the case it
 * was pooled into, and a way to open that operator's claims.
 * @param props - The table props.
 * @param props.items - One row for each named operator.
 * @returns The table.
 */
export function PlatformsTable(props: { items: PlatformRow[] }) {
  const t = useTranslations('StaffClaims');

  return (
    <DataTable
      columns={columns}
      data={props.items}
      getRowId={(row) => row.key}
      pageSize={25}
      searchPlaceholder={t('platforms_search')}
      labels={{
        name: t('platforms_col_name'),
        claims: t('platforms_col_claims'),
        confirmed: t('platforms_col_confirmed'),
        chains: t('platforms_col_chains'),
        latest: t('platforms_col_latest'),
        case: t('platforms_col_case'),
      }}
      empty={
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyTitle>{t('platforms_empty_title')}</EmptyTitle>
            <EmptyDescription>{t('platforms_empty_text')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
