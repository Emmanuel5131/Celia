'use client';

import { useTranslations } from 'next-intl';
import { ResultBadge } from '@/components/cases/ResultBadge';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { AddDialog } from '@/components/staff/AddDialog';
import { StatementForm } from '@/components/staff/AnalysisParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import type { ResearchRow } from '@/utils/cases/ResearchRows';

function Heading(props: { id: 'claim' | 'kind' | 'state' }) {
  const t = useTranslations('Research');

  return t(`${props.id}_label`);
}

function State(props: { row: ResearchRow }) {
  const t = useTranslations('Research');

  return props.row.result ? (
    <ResultBadge result={props.row.result} />
  ) : (
    <Badge variant="muted">{t(`state_${props.row.state}`)}</Badge>
  );
}

function Kind(props: { row: ResearchRow }) {
  const t = useTranslations('Research');

  return <span className="text-sm text-ink-muted">{t(`kind_${props.row.kind}`)}</span>;
}

type Row = ResearchRow & { caseId: string | null };

function Edit(props: { row: Row }) {
  const t = useTranslations('Research');
  const { row } = props;

  // A claim can change until research is planned for it, because the plan is fixed on its words.
  if (!row.caseId || (row.state !== 'not_researched' && row.state !== 'not_checkable')) {
    return null;
  }

  return (
    <AddDialog edit label={t('edit')} title={t('edit_title')} description={t('edit_text')}>
      <StatementForm
        caseId={row.caseId}
        statement={{ id: row.id, text: row.text, sourceUrl: row.sourceUrl, kind: row.kind }}
      />
    </AddDialog>
  );
}

function Open(props: { row: ResearchRow }) {
  const t = useTranslations('Research');

  return props.row.href ? (
    <Button asChild variant="outline" size="sm">
      <Link href={props.row.href}>{t(props.row.result ? 'open_report' : 'open')}</Link>
    </Button>
  ) : null;
}

const states = ['not_checkable', 'not_researched', 'researching', 'in_review', 'reported'] as const;

const helper = createAppColumnHelper<Row>();

const columns = helper.columns([
  helper.accessor('text', {
    id: 'claim',
    header: () => <Heading id="claim" />,
    cell: ({ getValue }) => <p className="min-w-64 whitespace-normal">{getValue()}</p>,
  }),
  helper.accessor('kind', {
    id: 'kind',
    header: () => <Heading id="kind" />,
    cell: ({ row }) => <Kind row={row.original} />,
    enableSorting: false,
  }),
  helper.accessor('state', {
    id: 'state',
    header: () => <Heading id="state" />,
    cell: ({ row }) => <State row={row.original} />,
    filterFn: 'inSet',
  }),
  helper.display({
    id: 'open',
    header: () => null,
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <Edit row={row.original} />
        <Open row={row.original} />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
]);

/**
 * The statements the platform made, each with where its research stands: its verdict once a report is saved, or what is still to
 * do. Each statement is researched on its own and has its own page, which the last column opens. The staff area and the case's
 * analysis list both use it.
 * @param props - The table props.
 * @param props.rows - One row for each statement.
 * @param props.caseId - Gives a claim nobody has planned research for an edit button, for staff; leave it out for a read-only table.
 * @param props.preview - Show the rows alone, without search or paging, for a short look that links to the full list.
 * @returns The table.
 */
export function ResearchTable(props: { rows: ResearchRow[]; caseId?: string; preview?: boolean }) {
  const t = useTranslations('Research');

  return (
    <DataTable
      toolbar={!props.preview}
      pagination={!props.preview}
      columns={columns}
      data={props.rows.map((row) => ({ ...row, caseId: props.caseId ?? null }))}
      getRowId={(row) => row.id}
      searchPlaceholder={t('search_placeholder')}
      labels={{ claim: t('claim_label'), kind: t('kind_label'), state: t('state_label') }}
      filters={[
        {
          columnId: 'state',
          title: t('state_label'),
          options: states.map((value) => ({ value, label: t(`state_${value}`) })),
        },
      ]}
    />
  );
}
