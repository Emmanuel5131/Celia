'use client';

import { evidenceSources, explorerLink } from '@celia/core';
import { TrashIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { removeCaseEvidence } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { AddDialog } from '@/components/staff/AddDialog';
import { ConfirmAction } from '@/components/staff/ConfirmAction';
import { EvidenceEditForm } from '@/components/staff/EvidenceForm';
import { EvidenceReviewForm, ReviewBadge } from '@/components/staff/EvidenceReview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CaseEvidence } from '@/libs/analysis/Evidence';
import { cn } from '@/utils/Cn';

type EvidenceRow = CaseEvidence & {
  caseId: string | null;
  statements: { id: string; text: string }[];
  actions: { id: string; title: string }[];
};

function Heading(props: { id: 'title' | 'source' | 'type' | 'where' | 'review' }) {
  const t = useTranslations('Staff');

  return t(`evidence_col_${props.id}`);
}

function Link(props: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer noopener"
      className="block max-w-56 truncate underline underline-offset-4 focus-ring"
    >
      {props.children}
    </a>
  );
}

/**
 * A long id, hash or address cut with an ellipsis so it never widens the table; the whole value is the tooltip.
 * @param props - The text props.
 * @param props.value - The whole value.
 * @param props.label - What to show instead of the value, when it differs.
 * @param props.className - Extra classes, such as a muted colour.
 * @returns The cut text.
 */
function Cut(props: { value: string; label?: string; className?: string }) {
  return (
    <span
      title={props.value}
      className={cn('block max-w-56 truncate font-mono text-xs', props.className)}
    >
      {props.label ?? props.value}
    </span>
  );
}

function Where(props: { row: EvidenceRow }) {
  const t = useTranslations('Staff');
  const { row } = props;

  if (row.fileUrl && row.cid) {
    return (
      <div className="grid gap-1">
        <Link href={row.fileUrl}>{t('evidence_open_file')}</Link>
        <Cut value={row.cid} label={`ipfs://${row.cid}`} className="text-ink-muted" />
      </div>
    );
  }

  if (row.chain && row.reference) {
    const explorer = explorerLink(
      row.chain,
      row.type === 'wallet' ? 'address' : 'tx',
      row.reference,
    );

    return (
      <div className="grid gap-1">
        <Cut value={row.reference} />
        {explorer && <Link href={explorer.url}>{explorer.name}</Link>}
      </div>
    );
  }

  return row.sourceUrl ? <Link href={row.sourceUrl}>{t('statements_source')}</Link> : null;
}

function SourceBadge(props: { source: EvidenceRow['source'] }) {
  const t = useTranslations('Staff');

  return <Badge variant="muted">{t(`evidence_source_${props.source}`)}</Badge>;
}

function TypeLabel(props: { type: EvidenceRow['type'] }) {
  const t = useTranslations('Staff');

  return t(`evidence_type_${props.type}`);
}

function Edit(props: { row: EvidenceRow }) {
  const t = useTranslations('Staff');

  if (!props.row.caseId) {
    return null;
  }

  return (
    <AddDialog
      edit
      label={t('evidence_edit')}
      title={t('evidence_edit_title')}
      description={t('evidence_edit_text')}
    >
      <EvidenceEditForm
        caseId={props.row.caseId}
        item={props.row}
        statements={props.row.statements}
        actions={props.row.actions}
      />
    </AddDialog>
  );
}

function Review(props: { row: EvidenceRow }) {
  const t = useTranslations('Staff');
  const { row } = props;

  // A notebook reads on-chain evidence, so only off-chain evidence has a review.
  if (row.source !== 'off_chain') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <ReviewBadge state={row.reviewState} />
      {row.caseId && (
        <AddDialog
          edit
          label={t('evidence_review_open')}
          title={t('evidence_review_title')}
          description={t('evidence_review_text')}
        >
          <EvidenceReviewForm caseId={row.caseId} item={row} />
        </AddDialog>
      )}
    </div>
  );
}

function Remove(props: { row: EvidenceRow }) {
  const t = useTranslations('Staff');
  const [pending, startTransition] = React.useTransition();
  const { caseId } = props.row;

  if (!caseId) {
    return null;
  }

  return (
    <ConfirmAction
      trigger={
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={t('evidence_remove')}
          disabled={pending}
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      }
      title={t('confirm_remove_title')}
      description={t('confirm_remove_evidence')}
      confirmLabel={t('evidence_remove')}
      pending={pending}
      onConfirm={() => {
        startTransition(async () => {
          await removeCaseEvidence(caseId, props.row.id);
        });
      }}
    />
  );
}

const helper = createAppColumnHelper<EvidenceRow>();

const columns = helper.columns([
  helper.accessor('title', {
    id: 'title',
    header: () => <Heading id="title" />,
    cell: ({ row }) => (
      <div className="grid min-w-48 gap-1 whitespace-normal">
        <span className="font-medium">{row.original.title}</span>
        {row.original.note && <span className="text-sm text-ink-muted">{row.original.note}</span>}
      </div>
    ),
  }),
  helper.accessor('source', {
    id: 'source',
    header: () => <Heading id="source" />,
    cell: ({ getValue }) => <SourceBadge source={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor('type', {
    id: 'type',
    header: () => <Heading id="type" />,
    cell: ({ getValue }) => <TypeLabel type={getValue()} />,
  }),
  helper.display({
    id: 'where',
    header: () => <Heading id="where" />,
    cell: ({ row }) => <Where row={row.original} />,
    enableSorting: false,
  }),
  helper.display({
    id: 'review',
    header: () => <Heading id="review" />,
    cell: ({ row }) => <Review row={row.original} />,
    enableSorting: false,
  }),
  helper.display({
    id: 'remove',
    header: () => null,
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <Edit row={row.original} />
        <Remove row={row.original} />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
]);

/**
 * The evidence a case rests on besides statements, off chain (videos, pictures, documents, links) and on chain (wallets and
 * transactions), with where each one can be checked.
 * @param props - The table props.
 * @param props.caseId - Gives each row a remove button, for staff; leave it out for a read-only table.
 * @param props.items - The evidence.
 * @param props.statements - The statements a piece of evidence can be linked to, when changing it.
 * @param props.actions - The alleged actions a piece of evidence can be attached to, when changing it.
 * @param props.preview - Show the rows alone, without search or paging, for a short look that links to the full list.
 * @returns The table.
 */
export function EvidenceTable(props: {
  caseId?: string;
  items: CaseEvidence[];
  statements?: { id: string; text: string }[];
  actions?: { id: string; title: string }[];
  preview?: boolean;
}) {
  const t = useTranslations('Staff');

  return (
    <DataTable
      columns={columns}
      toolbar={!props.preview}
      pagination={!props.preview}
      data={props.items.map((item) => ({
        ...item,
        caseId: props.caseId ?? null,
        statements: props.statements ?? [],
        actions: props.actions ?? [],
      }))}
      getRowId={(row) => row.id}
      searchPlaceholder={t('evidence_search_placeholder')}
      labels={{
        title: t('evidence_col_title'),
        source: t('evidence_col_source'),
        type: t('evidence_col_type'),
        where: t('evidence_col_where'),
        review: t('evidence_col_review'),
      }}
      filters={[
        {
          columnId: 'source',
          title: t('evidence_col_source'),
          options: evidenceSources.map((value) => ({
            value,
            label: t(`evidence_source_${value}`),
          })),
        },
      ]}
    />
  );
}
