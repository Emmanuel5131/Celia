'use client';

import { getJurisdiction } from '@celia/jurisdictions';
import { TrashIcon } from '@phosphor-icons/react';
import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import { removeCaseAction } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { ActionForm } from '@/components/staff/ActionForm';
import { AddDialog } from '@/components/staff/AddDialog';
import { ConfirmAction } from '@/components/staff/ConfirmAction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isActionKindPreset } from '@/utils/cases/Actions';
import type { ActionRow } from '@/utils/cases/Actions';
import { jurisdictionName } from '@/utils/cases/JurisdictionName';

type Row = ActionRow & { caseId: string | null };

function Heading(props: {
  id: 'action' | 'kind' | 'date' | 'jurisdiction' | 'on_chain' | 'off_chain';
}) {
  const t = useTranslations('Actions');

  return t(`col_${props.id}`);
}

function Action(props: { row: ActionRow }) {
  return (
    <div className="grid min-w-56 gap-1 whitespace-normal">
      <span className="font-medium">{props.row.title}</span>
      {props.row.note && <span className="text-sm text-ink-muted">{props.row.note}</span>}
    </div>
  );
}

function KindName(props: { value: string }) {
  const t = useTranslations('Actions');

  // A preset is shown in the reader's language; anything else is the staff member's own words.
  return isActionKindPreset(props.value) ? t(`kind_${props.value}`) : props.value;
}

function Kind(props: { value: string }) {
  return props.value ? (
    <Badge variant="muted">
      <KindName value={props.value} />
    </Badge>
  ) : null;
}

function When(props: { value: string | null }) {
  const format = useFormatter();

  return props.value ? format.dateTime(new Date(props.value), { dateStyle: 'medium' }) : null;
}

const placeOf = (id: string | null) => {
  const jurisdiction = id ? getJurisdiction(id) : undefined;

  return jurisdiction ? jurisdictionName(jurisdiction) : (id?.toUpperCase() ?? '');
};

function Edit(props: { row: Row }) {
  const t = useTranslations('Actions');

  if (!props.row.caseId) {
    return null;
  }

  return (
    <AddDialog edit label={t('edit')} title={t('edit_title')} description={t('edit_text')}>
      <ActionForm caseId={props.row.caseId} action={props.row} />
    </AddDialog>
  );
}

function Remove(props: { row: Row }) {
  const t = useTranslations('Actions');
  const [pending, startTransition] = React.useTransition();

  if (!props.row.caseId) {
    return null;
  }

  const { caseId, id } = props.row;

  return (
    <ConfirmAction
      trigger={
        <Button size="icon-sm" variant="outline" aria-label={t('remove')} disabled={pending}>
          <TrashIcon aria-hidden="true" />
        </Button>
      }
      title={t('remove_title')}
      description={t('remove_text')}
      confirmLabel={t('remove')}
      pending={pending}
      onConfirm={() => {
        startTransition(async () => {
          await removeCaseAction(caseId, id);
        });
      }}
    />
  );
}

const helper = createAppColumnHelper<Row>();

const columns = helper.columns([
  helper.accessor('title', {
    id: 'action',
    header: () => <Heading id="action" />,
    cell: ({ row }) => <Action row={row.original} />,
    enableSorting: false,
  }),
  helper.accessor((row) => row.kind ?? '', {
    id: 'kind',
    header: () => <Heading id="kind" />,
    cell: ({ getValue }) => <Kind value={getValue()} />,
    filterFn: 'inSet',
    enableSorting: false,
  }),
  helper.accessor((row) => row.occurredOn ?? '', {
    id: 'date',
    header: () => <Heading id="date" />,
    cell: ({ row }) => <When value={row.original.occurredOn} />,
    enableSorting: false,
  }),
  helper.accessor((row) => placeOf(row.jurisdiction), {
    id: 'jurisdiction',
    header: () => <Heading id="jurisdiction" />,
    enableSorting: false,
  }),
  helper.accessor('onChain', {
    id: 'on_chain',
    header: () => <Heading id="on_chain" />,
    enableSorting: false,
  }),
  helper.accessor('offChain', {
    id: 'off_chain',
    header: () => <Heading id="off_chain" />,
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
 * The actions the claimants allege, one to a row: what was done, its kind, when and where, and how much evidence backs it on the
 * chain and off it. They are allegations and findings of nothing. The staff case page and the case page for investigators both use
 * it. A column nobody filled in is left out.
 * @param props - The table props.
 * @param props.actions - The alleged actions with their evidence counts.
 * @param props.caseId - Gives each row a remove button; leave it out for a read-only table.
 * @param props.preview - Show the rows alone, without search or paging, for a short look that links to the full list.
 * @returns The table.
 */
export function ActionsTable(props: { actions: ActionRow[]; caseId?: string; preview?: boolean }) {
  const t = useTranslations('Actions');

  return (
    <DataTable
      toolbar={!props.preview}
      pagination={!props.preview}
      columns={columns}
      data={props.actions.map((action) => ({ ...action, caseId: props.caseId ?? null }))}
      getRowId={(row) => row.id}
      searchPlaceholder={t('search_placeholder')}
      labels={{
        action: t('col_action'),
        kind: t('col_kind'),
        date: t('col_date'),
        jurisdiction: t('col_jurisdiction'),
        on_chain: t('col_on_chain'),
        off_chain: t('col_off_chain'),
      }}
      filters={[
        {
          columnId: 'kind',
          title: t('col_kind'),
          options: [...new Set(props.actions.flatMap((action) => action.kind ?? []))].map(
            (value) => ({
              value,
              label: isActionKindPreset(value) ? t(`kind_${value}`) : value,
            }),
          ),
        },
      ]}
    />
  );
}
