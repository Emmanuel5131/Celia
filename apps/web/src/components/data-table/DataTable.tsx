'use client';

import type { ColumnDef, RowData } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTablePagination } from '@/components/data-table/DataTablePagination';
import { DataTableToolbar } from '@/components/data-table/DataTableToolbar';
import type { DataTableFilter } from '@/components/data-table/DataTableToolbar';
import { useAppTable } from '@/components/data-table/table';
import type { TableFeatures } from '@/components/data-table/table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DataTableProps<TData extends RowData> = {
  // Columns keep their own value types, so the value slot is `any` here only.
  // oxlint-disable-next-line typescript/no-explicit-any
  columns: ColumnDef<TableFeatures, TData, any>[];
  data: TData[];
  getRowId: (row: TData) => string;
  /** The translated name of each column by id: used by the columns menu and the filters. */
  labels?: Record<string, string>;
  searchPlaceholder?: string;
  filters?: DataTableFilter[];
  pageSize?: number;
  /** Search, filters and the columns menu. On by default. */
  toolbar?: boolean;
  /** The page controls under the table. On by default. */
  pagination?: boolean;
  /** Show the "n of m selected" count, for tables with a selection column. */
  selectable?: boolean;
  /** Shown in place of the whole table when there is no data at all, such as an empty state with its first action. */
  empty?: React.ReactElement;
  /** Adds an "Export" button to the toolbar. It receives the rows left after search and filters, not just the current page. */
  onExport?: (rows: TData[]) => void;
  /** Actions for the selected rows, such as "Delete selected". Shown in the toolbar while any row is selected. */
  selectionActions?: (rows: TData[]) => React.ReactNode;
};

const isBlank = (value: unknown) =>
  value === null || value === undefined || value === '' || value === '—';

/**
 * Finds the columns that would show nothing: every row's value is empty. They start hidden, so a table never carries a column of
 * dashes; the columns menu can still show them.
 * @param columns - The columns.
 * @param data - The rows.
 * @returns The visibility to start with, `false` for each empty column.
 */
function emptyColumns<TData extends RowData>(
  // oxlint-disable-next-line typescript/no-explicit-any
  columns: ColumnDef<TableFeatures, TData, any>[],
  data: TData[],
) {
  const hidden: Record<string, false> = {};

  if (data.length === 0) {
    return hidden;
  }

  for (const column of columns) {
    if (
      'accessorFn' in column &&
      column.id &&
      data.every((row, index) => isBlank(column.accessorFn(row, index)))
    ) {
      hidden[column.id] = false;
    }
  }

  return hidden;
}

/**
 * The one table for the whole app: TanStack Table for the behaviour (sorting, search, faceted filters, column visibility, row
 * selection, pagination) and our shadcn `Table` for the look. A screen only supplies columns and data. Turn the toolbar and
 * pagination off for a short read-only list. A column with no value in any row starts hidden.
 * @param props - The table props.
 * @returns The table with its toolbar and pagination.
 */
export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const t = useTranslations('DataTable');
  const labels = props.labels ?? {};
  const showToolbar = props.toolbar ?? true;
  const showPagination = props.pagination ?? true;

  const table = useAppTable({
    data: props.data,
    columns: props.columns,
    getRowId: props.getRowId,
    initialState: {
      pagination: { pageIndex: 0, pageSize: props.pageSize ?? 10 },
      columnVisibility: emptyColumns(props.columns, props.data),
    },
  });

  const { rows } = table.getRowModel();
  const exportRows = props.onExport;
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  if (props.empty && props.data.length === 0) {
    return props.empty;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {showToolbar && (
        <DataTableToolbar
          table={table}
          labels={labels}
          searchPlaceholder={props.searchPlaceholder ?? ''}
          filters={props.filters ?? []}
          selectionActions={
            props.selectionActions && selected.length > 0
              ? props.selectionActions(selected)
              : undefined
          }
          onExport={
            exportRows
              ? () => {
                  exportRows(table.getFilteredRowModel().rows.map((row) => row.original));
                }
              : undefined
          }
        />
      )}
      <div className="border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-ink-muted"
                >
                  {t('no_results')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination && <DataTablePagination table={table} showSelection={props.selectable} />}
    </div>
  );
}
