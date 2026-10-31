'use client';

import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import { ChainLabel } from '@/components/claims/ChainLabel';
import { useClaimLabels } from '@/components/claims/claim-labels';
import { ClaimStateBadge } from '@/components/claims/ClaimStateBadge';
import { ExplorerLink } from '@/components/claims/ExplorerLink';
import { useSignalLabels } from '@/components/staff/signal-labels';
import { Badge } from '@/components/ui/badge';
import type { ClaimRecord, PersonClaim } from '@/libs/claims/StaffClaims';
import { Link } from '@/libs/I18nNavigation';
import type { StoredCheck } from '@/utils/claims/Transaction';

export function When(props: { value: string | null; time?: boolean }) {
  const format = useFormatter();

  if (!props.value) {
    return null;
  }

  return format.dateTime(
    new Date(props.value),
    props.time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
  );
}

export function Types(props: { values: ClaimRecord['fraudTypes'] }) {
  const labels = useClaimLabels();

  return props.values.map((value) => labels.fraudType[value]).join(', ');
}

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

function Missing() {
  const t = useTranslations('StaffClaims');

  return <span className="text-ink-muted">{t('not_on_file')}</span>;
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

export function ClaimDetails(props: { record: ClaimRecord; others: PersonClaim[] }) {
  const t = useTranslations('StaffClaims');
  const labels = useClaimLabels();
  const signalLabels = useSignalLabels();
  const { record } = props;

  return (
    <div className="grid gap-6 text-sm">
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
        <Field label={t('f_name')}>{record.name ?? <Missing />}</Field>
        <Field label={t('f_email')}>
          {record.email ? (
            <a href={`mailto:${record.email}`} className="underline underline-offset-4 focus-ring">
              {record.email}
            </a>
          ) : (
            <Missing />
          )}
        </Field>
        <Field label={t('f_country')}>{record.country}</Field>
        <Field label={t('f_user')}>
          <span className="font-mono text-xs break-all">{record.userId}</span>
        </Field>
        <Field label={t('f_other_claims')}>
          {props.others.length > 0 ? (
            <ul className="grid gap-2">
              {props.others.map((other) => (
                <li key={other.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/staff/claims/${other.id}`}
                    className="font-medium underline underline-offset-4 focus-ring"
                  >
                    {other.platformName ?? t('detail_unnamed')}
                  </Link>
                  <ClaimStateBadge state={other.state} />
                  <span className="text-ink-muted">
                    <When value={other.at} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-ink-muted">{t('no_other_claims')}</span>
          )}
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
