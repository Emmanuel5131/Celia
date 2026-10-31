'use client';

import type { Column } from '@tanstack/react-table';
import { useFormatter, useTranslations } from 'next-intl';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { createSelectColumn } from '@/components/data-table/select-column';
import { createAppColumnHelper } from '@/components/data-table/table';
import type { TableFeatures } from '@/components/data-table/table';
import { StatusBadge } from '@/components/overview/StatusBadge';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import { caseStatusOrder } from '@/utils/cases/Case';
import type { CaseRow, CaseStatus } from '@/utils/cases/Case';

type CaseColumnId = 'case' | 'jurisdictions' | 'claimants' | 'confirmed' | 'status' | 'updated';

/**
 * The translated name of every case column, by column id. Headings, the columns menu and the filters all read it, so a column
 * is named in one place.
 * @returns The labels.
 */
export function useCaseColumnLabels(): Record<CaseColumnId, string> {
  const t = useTranslations('CaseBank');

  return {
    case: t('col_case'),
    jurisdictions: t('col_jurisdictions'),
    claimants: t('col_claimants'),
    confirmed: t('col_confirmed'),
    status: t('col_status'),
    updated: t('col_updated'),
  };
}

function CaseHeader<TValue>(props: {
  column: Column<TableFeatures, CaseRow, TValue>;
  id: CaseColumnId;
  align?: 'start' | 'end';
}) {
  const labels = useCaseColumnLabels();

  return (
    <DataTableColumnHeader column={props.column} title={labels[props.id]} align={props.align} />
  );
}

/**
 * The way into a case: its page is the overview, so there is no preview panel.
 * @param props - The cell props.
 * @param props.caseRow - The case.
 * @returns The link.
 */
function OpenCell(props: { caseRow: CaseRow }) {
  const t = useTranslations('CaseBank');

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/dashboard/cases/${props.caseRow.id}`}>{t('open_case')}</Link>
    </Button>
  );
}

function CaseCell(props: { caseRow: CaseRow; linked: boolean }) {
  const content = (
    <>
      <p className="font-medium">{props.caseRow.name}</p>
      <p className="font-mono text-xs text-ink-muted">{props.caseRow.number}</p>
    </>
  );

  return props.linked ? (
    <Link
      href={`/dashboard/cases/${props.caseRow.id}`}
      className="block focus-ring hover:underline hover:underline-offset-4"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

function ClaimantsCell(props: { value: number }) {
  const format = useFormatter();

  return <p className="text-right tabular-nums">{format.number(props.value)}</p>;
}

function UpdatedCell(props: { value: string }) {
  const format = useFormatter();

  return (
    <span className="text-ink-muted">
      {format.dateTime(new Date(props.value), { dateStyle: 'medium' })}
    </span>
  );
}

const helper = createAppColumnHelper<CaseRow>();

/**
 * Builds the columns of a case table. A linked table opens the case page from the case name and has a link to it. Call it at
 * module scope so the table never rebuilds the columns.
 * @param linked - Whether the case name links to its page.
 * @returns The columns.
 */
function createCaseColumns(linked: boolean) {
  const columns = helper.columns([
    helper.accessor((row) => `${row.name} ${row.number}`, {
      id: 'case',
      header: ({ column }) => <CaseHeader column={column} id="case" />,
      cell: ({ row }) => <CaseCell caseRow={row.original} linked={linked} />,
    }),
    helper.accessor('jurisdictions', {
      id: 'jurisdictions',
      header: ({ column }) => <CaseHeader column={column} id="jurisdictions" align="end" />,
      cell: ({ getValue }) => <ClaimantsCell value={getValue()} />,
    }),
    helper.accessor('claimants', {
      id: 'claimants',
      header: ({ column }) => <CaseHeader column={column} id="claimants" align="end" />,
      cell: ({ getValue }) => <ClaimantsCell value={getValue()} />,
    }),
    helper.accessor('confirmed', {
      id: 'confirmed',
      header: ({ column }) => <CaseHeader column={column} id="confirmed" align="end" />,
      cell: ({ getValue }) => <ClaimantsCell value={getValue()} />,
    }),
    helper.accessor('status', {
      id: 'status',
      header: ({ column }) => <CaseHeader column={column} id="status" />,
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      filterFn: 'inSet',
      sortFn: (a, b, columnId) =>
        caseStatusOrder[a.getValue<CaseStatus>(columnId)] -
        caseStatusOrder[b.getValue<CaseStatus>(columnId)],
    }),
    helper.accessor('updatedAt', {
      id: 'updated',
      header: ({ column }) => <CaseHeader column={column} id="updated" />,
      cell: ({ getValue }) => <UpdatedCell value={getValue()} />,
    }),
  ]);

  // A linked table offers a link to the case page, which is the overview.
  return linked
    ? [
        ...columns,
        helper.display({
          id: 'open',
          header: () => null,
          cell: ({ row }) => <OpenCell caseRow={row.original} />,
          enableSorting: false,
          enableHiding: false,
        }),
      ]
    : columns;
}

/** The columns of a read-only case table, linked to each case page. */
export const caseColumns = createCaseColumns(true);

/** The linked columns with a leading checkbox column, for the full case bank list. */
export const selectableCaseColumns = [createSelectColumn<CaseRow>(), ...createCaseColumns(true)];
