'use client';

import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import { ChainLabel } from '@/components/claims/ChainLabel';
import { useClaimLabels } from '@/components/claims/claim-labels';
import { ClaimStateBadge } from '@/components/claims/ClaimStateBadge';
import { ExplorerLink } from '@/components/claims/ExplorerLink';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { useSignalLabels } from '@/components/staff/signal-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ClaimRecord } from '@/libs/claims/StaffClaims';
import { Link } from '@/libs/I18nNavigation';
import { registerPageSize, registerStates } from '@/utils/claims/ClaimRegister';
import type { RegisterState } from '@/utils/claims/ClaimRegister';
import type { StoredCheck } from '@/utils/claims/Transaction';

const OpenContext = React.createContext<(id: string) => void>(() => null);

function Heading(props: {
  id: 'claim' | 'state' | 'platform' | 'type' | 'chain' | 'amount' | 'person' | 'country' | 'sent';
}) {
  const t = useTranslations('StaffClaims');

  return t(`col_${props.id}`);
}

function When(props: { value: string | null; time?: boolean }) {
  const format = useFormatter();

  if (!props.value) {
    return null;
  }

  return format.dateTime(
    new Date(props.value),
    props.time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
  );
}

function Types(props: { values: ClaimRecord['fraudTypes'] }) {
  const labels = useClaimLabels();

  return props.values.map((value) => labels.fraudType[value]).join(', ');
}

function DetailsButton(props: { id: string }) {
  const t = useTranslations('StaffClaims');
  const open = React.useContext(OpenContext);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        open(props.id);
      }}
    >
      {t('details')}
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
  helper.accessor((row) => row.name ?? row.email ?? '', {
    id: 'person',
    header: () => <Heading id="person" />,
    cell: ({ row }) => (
      <div className="grid">
        <span>{row.original.name ?? '—'}</span>
        <span className="text-xs text-ink-muted">{row.original.email ?? ''}</span>
      </div>
    ),
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

function Field(props: { label: string; children?: React.ReactNode }) {
  if (props.children === null || props.children === undefined || props.children === '') {
    return null;
  }

  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-ink-muted">{props.label}</dt>
      <dd className="break-words whitespace-pre-wrap">{props.children}</dd>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line-soft pt-4">
      <h3 className="font-medium">{props.title}</h3>
      <dl className="grid gap-2">{props.children}</dl>
    </section>
  );
}

function Mono(props: {
  value: string | null;
  chain?: ClaimRecord['chain'];
  kind?: 'tx' | 'address';
}) {
  if (!props.value) {
    return null;
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs break-all">{props.value}</span>
      {props.chain && props.kind && (
        <ExplorerLink chain={props.chain} kind={props.kind} value={props.value} compact />
      )}
    </span>
  );
}

function CheckLine(props: { check: StoredCheck | null }) {
  const t = useTranslations('StaffClaims');

  if (!props.check) {
    return null;
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="dashed">
        {t(props.check.status === 'found' ? 'check_found' : 'check_not_found')}
      </Badge>
      {props.check.role && (
        <span className="text-ink-muted">{t(`check_role_${props.check.role}`)}</span>
      )}
      <span className="text-ink-muted">
        <When value={props.check.checkedAt} time />
      </span>
    </span>
  );
}

function pick(map: Record<string, string>, key: string | null) {
  return key ? (map[key] ?? key) : null;
}

function Link2(props: { href: string | null }) {
  if (!props.href) {
    return null;
  }

  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all underline underline-offset-4 focus-ring"
    >
      {props.href}
    </a>
  );
}

function ClaimDetails(props: { record: ClaimRecord }) {
  const t = useTranslations('StaffClaims');
  const labels = useClaimLabels();
  const signalLabels = useSignalLabels();
  const { record } = props;

  return (
    <div className="grid gap-6 overflow-y-auto px-4 pb-8 text-sm">
      {record.signals.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('section_flags')}>
          {record.signals.map((signal) => (
            <li key={signal}>
              <Badge variant="dashed">{signalLabels[signal]}</Badge>
            </li>
          ))}
        </ul>
      )}

      <Section title={t('section_status')}>
        <Field label={t('f_id')}>
          <span className="font-mono text-xs">{record.id}</span>
        </Field>
        <Field label={t('f_state')}>
          <ClaimStateBadge state={record.state} />
        </Field>
        <Field label={t('f_started')}>
          <When value={record.createdAt} time />
        </Field>
        <Field label={t('f_consented')}>
          <When value={record.consentedAt} time />
        </Field>
        <Field label={t('f_sent')}>
          <When value={record.submittedAt} time />
        </Field>
        <Field label={t('f_review_started')}>
          <When value={record.staffReviewStartedAt} time />
        </Field>
        <Field label={t('f_confirmed')}>
          <When value={record.validatedAt} time />
        </Field>
        <Field label={t('f_rejected')}>
          <When value={record.rejectedAt} time />
        </Field>
        <Field label={t('f_rejection_note')}>{record.rejectionNote}</Field>
        <Field label={t('f_updated')}>
          <When value={record.updatedAt} time />
        </Field>
      </Section>

      <Section title={t('section_person')}>
        <Field label={t('f_name')}>{record.name}</Field>
        <Field label={t('f_email')}>{record.email}</Field>
        <Field label={t('f_user')}>
          <span className="font-mono text-xs break-all">{record.userId}</span>
        </Field>
      </Section>

      <Section title={t('section_claim')}>
        <Field label={t('f_types')}>
          <Types values={record.fraudTypes} />
        </Field>
        <Field label={t('f_amount')}>{record.amountLost}</Field>
        <Field label={t('f_asset')}>{record.assetSent}</Field>
        <Field label={t('f_token')}>{record.tokenName}</Field>
        <Field label={t('f_token_contract')}>
          <Mono value={record.tokenContract} chain={record.chain} kind="address" />
        </Field>
        <Field label={t('f_country')}>{record.country}</Field>
        <Field label={t('f_contact')}>{pick(labels.contactChannel, record.contactChannel)}</Field>
        <Field label={t('f_operator')}>{record.operatorHandle}</Field>
        <Field label={t('f_description')}>{record.fraudDescription}</Field>
        <Field label={t('f_statement')}>{record.statement}</Field>
      </Section>

      <Section title={t('section_wallet')}>
        <Field label={t('f_chain')}>
          <ChainLabel chain={record.chain} />
        </Field>
        <Field label={t('f_payment')}>{pick(labels.paymentMethod, record.paymentMethod)}</Field>
        <Field label={t('f_wallet')}>
          <Mono value={record.walletAddress} chain={record.chain} kind="address" />
        </Field>
        <Field label={t('f_wallet_type')}>{pick(labels.walletType, record.walletType)}</Field>
        <Field label={t('f_account_kind')}>{pick(labels.accountKind, record.accountKind)}</Field>
        <Field label={t('f_wallet_app')}>{pick(labels.walletApp, record.walletApp)}</Field>
        <Field label={t('f_destination')}>
          <Mono value={record.destinationAddress} chain={record.chain} kind="address" />
        </Field>
        <Field label={t('f_tx')}>
          <Mono value={record.txHash} chain={record.chain} kind="tx" />
        </Field>
        <Field label={t('f_tx_check')}>
          <CheckLine check={record.txCheck} />
        </Field>
        <Field label={t('f_funding_tx')}>
          <Mono value={record.fundingTxHash} chain={record.chain} kind="tx" />
        </Field>
        <Field label={t('f_funding_check')}>
          <CheckLine check={record.fundingTxCheck} />
        </Field>
      </Section>

      <Section title={t('section_ownership')}>
        <Field label={t('f_ownership')}>
          <Badge variant={record.signed ? 'solid' : 'dashed'}>
            {t(record.signed ? 'ownership_signed' : 'ownership_unsigned')}
          </Badge>
        </Field>
        <Field label={t('f_method')}>{record.ownershipMethod}</Field>
        <Field label={t('f_signed_at')}>
          <When value={record.signedAt} time />
        </Field>
      </Section>

      <Section title={t('section_platform')}>
        <Field label={t('f_platform_name')}>{record.platformName}</Field>
        <Field label={t('f_platform_url')}>
          <Link2 href={record.platformUrl} />
        </Field>
        <Field label={t('f_platform_host')}>{record.platformHost}</Field>
        <Field label={t('f_platform_key')}>
          <span className="font-mono text-xs break-all">{record.platformKey}</span>
        </Field>
      </Section>

      <Section title={t('section_proof')}>
        <Field label={t('f_video')}>
          <Link2 href={record.reviewVideoUrl} />
        </Field>
        <Field label={t('f_note')}>{record.proofNote}</Field>
        <Field label={t('f_review_requested')}>
          <When value={record.reviewRequestedAt} time />
        </Field>
        <Field label={t('f_reviewed')}>
          <When value={record.reviewedAt} time />
        </Field>
        <Field label={t('f_review_note')}>{record.reviewNote}</Field>
        <Field label={t('f_files')}>
          {record.files.length > 0 && (
            <ul className="grid gap-1">
              {record.files.map((file) => (
                <li key={file.id}>
                  <a
                    href={`/api/claims/${record.id}/proofs/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 focus-ring"
                  >
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </Section>
    </div>
  );
}

const base = '/dashboard/staff/claims';

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
 * Every claim in the case bank for staff: filter by state, search by platform, wallet or transaction, and open any claim to see
 * everything held about it. Filtering and paging happen on the server, so the page stays fast with any number of claims.
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
  const [openId, setOpenId] = React.useState<string | null>(null);
  const current = props.records.find((record) => record.id === openId);
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

      <OpenContext.Provider value={setOpenId}>
        <DataTable
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
      </OpenContext.Provider>

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

      <Sheet
        open={current !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setOpenId(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle>{current.platformName ?? t('detail_unnamed')}</SheetTitle>
                <SheetDescription>{current.id}</SheetDescription>
              </SheetHeader>
              <ClaimDetails record={current} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
