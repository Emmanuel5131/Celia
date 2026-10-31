'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import { CaseStage } from '@/components/staff/CaseStage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import type { AnalysisStatus } from '@/utils/analysis/Status';
import { caseStatuses } from '@/utils/cases/Case';
import type { CaseRow, CaseStatus } from '@/utils/cases/Case';

/** A case as staff see it in the list: the case and where its analysis stands. */
type StaffCaseRow = CaseRow & { analysis: AnalysisStatus };

function Heading(props: {
  id: 'case' | 'jurisdictions' | 'victims' | 'status' | 'updated' | 'next' | 'open';
}) {
  const t = useTranslations('Staff');

  return t(`col_${props.id}`);
}

const nextStepBadge = {
  needs_plan: 'dashed',
  agent_working: 'default',
  report_saved: 'solid',
} as const;

function NextStep(props: { row: StaffCaseRow }) {
  const t = useTranslations('Staff');

  return (
    <Badge variant={nextStepBadge[props.row.analysis]}>{t(`status_${props.row.analysis}`)}</Badge>
  );
}

function OpenCase(props: { row: StaffCaseRow }) {
  const t = useTranslations('Staff');

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/dashboard/staff/cases/${props.row.id}`}>{t('case_open')}</Link>
    </Button>
  );
}

function UpdatedText(props: { value: string }) {
  const format = useFormatter();

  return format.dateTime(new Date(props.value), { dateStyle: 'medium' });
}

const helper = createAppColumnHelper<StaffCaseRow>();

const columns = helper.columns([
  helper.accessor((row) => `${row.name} ${row.number}`, {
    id: 'case',
    header: () => <Heading id="case" />,
    cell: ({ row }) => (
      <>
        <p className="font-medium">{row.original.name}</p>
        <p className="font-mono text-xs text-ink-muted">{row.original.number}</p>
      </>
    ),
  }),
  helper.accessor('jurisdictions', {
    id: 'jurisdictions',
    header: () => <Heading id="jurisdictions" />,
  }),
  helper.accessor('claimants', { id: 'victims', header: () => <Heading id="victims" /> }),
  helper.accessor('status', {
    id: 'status',
    header: () => <Heading id="status" />,
    cell: ({ row }) => (
      <CaseStage
        id={row.original.id}
        status={row.original.status}
        hasReport={row.original.hasReport}
      />
    ),
    // The filter picks one or more stages; sorting follows the order a case moves through them.
    filterFn: 'inSet',
    sortFn: (a, b, columnId) =>
      caseStatuses.indexOf(a.getValue<CaseStatus>(columnId)) -
      caseStatuses.indexOf(b.getValue<CaseStatus>(columnId)),
  }),
  helper.accessor('analysis', {
    id: 'next',
    header: () => <Heading id="next" />,
    cell: ({ row }) => <NextStep row={row.original} />,
    filterFn: 'inSet',
  }),
  helper.accessor('updatedAt', {
    id: 'updated',
    header: () => <Heading id="updated" />,
    cell: ({ getValue }) => <UpdatedText value={getValue()} />,
  }),
  helper.display({
    id: 'open',
    header: () => <Heading id="open" />,
    cell: ({ row }) => <OpenCase row={row.original} />,
    enableSorting: false,
  }),
]);

/**
 * Staff's view of the cases: every case with its stage, which only staff move, between building and enough evidence. A case
 * opens by itself when its first claim is sent, so there is nothing to open here.
 * @param props - The admin props.
 * @param props.cases - Every case.
 * @returns The table.
 */
export function CaseAdmin(props: { cases: StaffCaseRow[] }) {
  const t = useTranslations('CaseBank');
  const staff = useTranslations('Staff');

  return (
    <div className="grid gap-4">
      <DataTable
        columns={columns}
        data={props.cases}
        getRowId={(row) => row.id}
        pageSize={25}
        searchPlaceholder={t('search_placeholder')}
        labels={{
          case: staff('col_case'),
          jurisdictions: staff('col_jurisdictions'),
          victims: staff('col_victims'),
          status: staff('col_status'),
          updated: staff('col_updated'),
          next: staff('col_next'),
          open: staff('col_open'),
        }}
        filters={[
          {
            columnId: 'status',
            title: staff('col_status'),
            // Every stage can be picked, so staff can look at just the cases in one of them.
            options: caseStatuses.map((value) => ({ value, label: t(`status_${value}`) })),
          },
          {
            columnId: 'next',
            title: staff('col_next'),
            // Staff can look at only the cases that wait on them, or only the ones with a report.
            options: (['needs_plan', 'agent_working', 'report_saved'] as const).map((value) => ({
              value,
              label: staff(`status_${value}`),
            })),
          },
        ]}
      />
    </div>
  );
}
