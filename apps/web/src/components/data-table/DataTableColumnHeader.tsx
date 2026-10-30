'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretUpDownIcon,
  EyeSlashIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { Column, RowData } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { TableFeatures } from '@/components/data-table/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/Cn';

/**
 * A column heading. A sortable column becomes a menu: ascending, descending, clear sort and hide column. The arrow shows the
 * current sort, and the heading keeps its alignment so numbers stay right-aligned over their column.
 * @param props - The heading props.
 * @param props.column - The table column.
 * @param props.title - The translated heading text.
 * @param props.align - `end` right-aligns the heading, for numeric columns.
 * @returns The heading.
 */
export function DataTableColumnHeader<TData extends RowData, TValue>(props: {
  column: Column<TableFeatures, TData, TValue>;
  title: string;
  align?: 'start' | 'end';
}) {
  const t = useTranslations('DataTable');
  const { column } = props;
  const sorted = column.getIsSorted();

  if (!column.getCanSort()) {
    return <span className={cn(props.align === 'end' && 'block text-right')}>{props.title}</span>;
  }

  return (
    <div className={cn('flex', props.align === 'end' && 'justify-end')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-mx-3 h-8 px-3 text-xs font-medium text-ink-muted data-[state=open]:bg-paper"
          >
            {props.title}
            {sorted === 'asc' && <ArrowUpIcon aria-label={t('sorted_ascending')} />}
            {sorted === 'desc' && <ArrowDownIcon aria-label={t('sorted_descending')} />}
            {!sorted && <CaretUpDownIcon aria-hidden="true" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={props.align === 'end' ? 'end' : 'start'} className="min-w-48">
          <DropdownMenuItem
            onClick={() => {
              column.toggleSorting(false);
            }}
          >
            <ArrowUpIcon aria-hidden="true" />
            {t('sort_ascending')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              column.toggleSorting(true);
            }}
          >
            <ArrowDownIcon aria-hidden="true" />
            {t('sort_descending')}
          </DropdownMenuItem>
          {sorted && (
            <DropdownMenuItem
              onClick={() => {
                column.clearSorting();
              }}
            >
              <XIcon aria-hidden="true" />
              {t('sort_clear')}
            </DropdownMenuItem>
          )}
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  column.toggleVisibility(false);
                }}
              >
                <EyeSlashIcon aria-hidden="true" />
                {t('hide_column')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
