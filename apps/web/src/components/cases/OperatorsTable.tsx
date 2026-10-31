'use client';

import { getJurisdiction } from '@celia/jurisdictions';
import { TrashIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { removeCaseOperator } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { AddDialog } from '@/components/staff/AddDialog';
import { ConfirmAction } from '@/components/staff/ConfirmAction';
import { OperatorForm } from '@/components/staff/OperatorForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { jurisdictionName } from '@/utils/cases/JurisdictionName';
import { operatorRoles } from '@/utils/cases/Operators';
import type { CaseOperator } from '@/utils/cases/Operators';

function Heading(props: { id: 'name' | 'role' | 'jurisdiction' | 'notes' }) {
  const t = useTranslations('Operators');

  return t(`col_${props.id}`);
}

function Role(props: { operator: CaseOperator }) {
  const t = useTranslations('Operators');
  const { role, roleNote } = props.operator;

  if (!role) {
    return null;
  }

  // "Other" is shown as the words staff gave for it, when they gave any.
  return (
    <Badge variant="muted">{role === 'other' && roleNote ? roleNote : t(`role_${role}`)}</Badge>
  );
}

const placeOf = (id: string | null) => {
  const jurisdiction = id ? getJurisdiction(id) : undefined;

  return jurisdiction ? jurisdictionName(jurisdiction) : (id?.toUpperCase() ?? '');
};

type OperatorRow = CaseOperator & { index: number; caseId: string | null };

function Edit(props: { row: OperatorRow }) {
  const t = useTranslations('Operators');

  if (!props.row.caseId) {
    return null;
  }

  return (
    <AddDialog edit label={t('edit')} title={t('edit_title')} description={t('edit_text')}>
      <OperatorForm caseId={props.row.caseId} index={props.row.index} operator={props.row} />
    </AddDialog>
  );
}

function Remove(props: { row: OperatorRow }) {
  const t = useTranslations('Operators');
  const [pending, startTransition] = React.useTransition();

  if (!props.row.caseId) {
    return null;
  }

  const { caseId, index } = props.row;

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
          await removeCaseOperator(caseId, index);
        });
      }}
    />
  );
}

const helper = createAppColumnHelper<OperatorRow>();

const columns = helper.columns([
  helper.accessor('name', {
    id: 'name',
    header: () => <Heading id="name" />,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    enableSorting: false,
  }),
  helper.accessor((row) => row.role ?? '', {
    id: 'role',
    header: () => <Heading id="role" />,
    cell: ({ row }) => <Role operator={row.original} />,
    filterFn: 'inSet',
    enableSorting: false,
  }),
  helper.accessor((row) => placeOf(row.jurisdiction), {
    id: 'jurisdiction',
    header: () => <Heading id="jurisdiction" />,
    enableSorting: false,
  }),
  helper.accessor((row) => row.notes ?? '', {
    id: 'notes',
    header: () => <Heading id="notes" />,
    cell: ({ getValue }) => (
      <p className="max-w-prose min-w-64 whitespace-pre-wrap">{getValue()}</p>
    ),
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
 * The people and groups the claimants allege are behind a platform, one to a row, with what each is alleged to do, where they are
 * linked to and the notes. They are allegations and findings of nothing. The staff case page and the case page for investigators
 * both use it. A column nobody filled in is left out.
 * @param props - The table props.
 * @param props.operators - The people and groups.
 * @param props.caseId - Gives each row a remove button; leave it out for a read-only table.
 * @param props.preview - Show the rows alone, without search or paging, for a short look that links to the full list.
 * @returns The table.
 */
export function OperatorsTable(props: {
  operators: CaseOperator[];
  caseId?: string;
  preview?: boolean;
}) {
  const t = useTranslations('Operators');

  return (
    <DataTable
      toolbar={!props.preview}
      pagination={!props.preview}
      columns={columns}
      data={props.operators.map((operator, index) => ({
        ...operator,
        index,
        caseId: props.caseId ?? null,
      }))}
      getRowId={(row) => String(row.index)}
      searchPlaceholder={t('search_placeholder')}
      labels={{
        name: t('col_name'),
        role: t('col_role'),
        jurisdiction: t('col_jurisdiction'),
        notes: t('col_notes'),
      }}
      filters={[
        {
          columnId: 'role',
          title: t('col_role'),
          options: operatorRoles.map((value) => ({ value, label: t(`role_${value}`) })),
        },
      ]}
    />
  );
}
