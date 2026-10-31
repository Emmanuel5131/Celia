'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { ChainLabel } from '@/components/claims/ChainLabel';
import { ClaimStateBadge } from '@/components/claims/ClaimStateBadge';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { Types, When } from '@/components/staff/ClaimDetails';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import type { ClaimRecord } from '@/libs/claims/StaffClaims';
import { Link } from '@/libs/I18nNavigation';
import { registerPageSize, registerStates } from '@/utils/claims/ClaimRegister';
import type { RegisterState } from '@/utils/claims/ClaimRegister';

function Heading(props: {
  id: 'claim' | 'state' | 'platform' | 'type' | 'chain' | 'amount' | 'country' | 'sent';
}) {
  const t = useTranslations('StaffClaims');

  return t(`col_${props.id}`);
}

const base = '/dashboard/staff/claims';

function DetailsButton(props: { id: string }) {
  const t = useTranslations('StaffClaims');

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`${base}/${props.id}`}>{t('details')}</Link>
    </Button>
  );
}

function FlagBadge(props: { count: number }) {
  const t = useTranslations('Staff');

  return <Badge variant="dashed">{t('claims_flags', { count: props.count })}</Badge>;
}

const helper = createAppColumnHelper<ClaimRecord>();

const columns = helper.columns([
  helper.accessor('id', {
    id: 'claim',
    header: () => <Heading id="claim" />,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue().slice(0, 8)}</span>,
    enableSorting: false,
  }),
  helper.accessor('state', {
    id: 'state',
    header: () => <Heading id="state" />,
    cell: ({ getValue }) => <ClaimStateBadge state={getValue()} />,
    enableSorting: false,
  }),
  helper.accessor((row) => row.platformName ?? '', {
    id: 'platform',
    header: () => <Heading id="platform" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{row.original.platformName ?? '—'}</span>
        {row.original.signals.length > 0 && <FlagBadge count={row.original.signals.length} />}
      </div>
    ),
    enableSorting: false,
  }),
  helper.accessor('fraudTypes', {
    id: 'type',
    header: () => <Heading id="type" />,
    cell: ({ getValue }) => (
      <span className="line-clamp-2 block max-w-56">
        <Types values={getValue()} />
      </span>
    ),
    enableSorting: false,
  }),
  helper.accessor('chain', {
    id: 'chain',
    header: () => <Heading id="chain" />,
    cell: ({ getValue }) => <ChainLabel chain={getValue()} />,
    enableSorting: false,
  }),
  helper.accessor((row) => row.amountLost ?? '', {
    id: 'amount',
    header: () => <Heading id="amount" />,
    enableSorting: false,
  }),
  helper.accessor((row) => row.country ?? '', {
    id: 'country',
    header: () => <Heading id="country" />,
    enableSorting: false,
  }),
  helper.accessor((row) => row.submittedAt ?? row.createdAt, {
    id: 'sent',
    header: () => <Heading id="sent" />,
    cell: ({ getValue }) => (
      <span className="text-ink-muted">
        <When value={getValue()} />
      </span>
    ),
    enableSorting: false,
  }),
  helper.display({
    id: 'details',
    header: () => null,
    cell: ({ row }) => <DetailsButton id={row.original.id} />,
    enableSorting: false,
    enableHiding: false,
  }),
]);

function registerHref(query: { status: RegisterState; q: string; page: number }) {
  const params = new URLSearchParams({ view: 'all' });

  if (query.status !== 'all') {
    params.set('status', query.status);
  }

  if (query.q) {
    params.set('q', query.q);
  }

  if (query.page > 1) {
    params.set('page', String(query.page));
  }

  return `${base}?${params.toString()}`;
}

/**
 * Every claim in the case bank for staff: filter by state, search by platform, wallet or transaction, and open any claim on its
 * own page to see everything held about it. Filtering and paging happen on the server, so the page stays fast with any number of claims.
 * @param props - The register props.
 * @param props.records - The claims on this page.
 * @param props.total - How many claims match the filter and the search in all.
 * @param props.page - The page, from 1.
 * @param props.state - The state filter.
 * @param props.search - The search text.
 * @returns The register.
 */
export function ClaimRegister(props: {
  records: ClaimRecord[];
  total: number;
  page: number;
  state: RegisterState;
  search: string;
}) {
  const t = useTranslations('StaffClaims');
  const states = useTranslations('ClaimList');
  const format = useFormatter();
  const from = props.total === 0 ? 0 : (props.page - 1) * registerPageSize + 1;
  const to = Math.min(props.page * registerPageSize, props.total);
  const hasPrevious = props.page > 1;
  const hasNext = to < props.total;
  const query = { status: props.state, q: props.search };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label={t('register_status_label')} className="flex flex-wrap gap-2">
          {registerStates.map((state) => (
            <Button
              key={state}
              asChild
              size="sm"
              variant={props.state === state ? 'default' : 'outline'}
            >
              <Link href={registerHref({ ...query, status: state, page: 1 })}>
                {state === 'all' ? t('register_status_all') : states(`state_${state}`)}
              </Link>
            </Button>
          ))}
        </nav>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="view" value="all" />
          {props.state !== 'all' && <input type="hidden" name="status" value={props.state} />}
          <Input
            name="q"
            type="search"
            defaultValue={props.search}
            placeholder={t('register_search_placeholder')}
            aria-label={t('register_search_label')}
            className="w-72"
          />
          <Button type="submit" size="sm" variant="outline">
            {t('register_search_submit')}
          </Button>
        </form>
      </div>

      <DataTable
        key={`${props.state}:${props.search}:${props.page}`}
        columns={columns}
        data={props.records}
        getRowId={(row) => row.id}
        toolbar={false}
        pagination={false}
        pageSize={registerPageSize}
        empty={
          <Empty className="border border-border bg-surface">
            <EmptyHeader>
              <EmptyTitle>{t('register_empty_title')}</EmptyTitle>
              <EmptyDescription>{t('register_empty_text')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
        <p>
          {t('register_showing', {
            from: format.number(from),
            to: format.number(to),
            total: format.number(props.total),
          })}
        </p>
        <div className="flex gap-2">
          {hasPrevious ? (
            <Button asChild size="sm" variant="outline">
              <Link href={registerHref({ ...query, page: props.page - 1 })}>
                {t('register_previous')}
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              {t('register_previous')}
            </Button>
          )}
          {hasNext ? (
            <Button asChild size="sm" variant="outline">
              <Link href={registerHref({ ...query, page: props.page + 1 })}>
                {t('register_next')}
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              {t('register_next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
