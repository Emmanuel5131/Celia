'use client';

import { useTranslations } from 'next-intl';
import { ResultBadge } from '@/components/cases/ResultBadge';
import { DataTable } from '@/components/data-table/DataTable';
import { createAppColumnHelper } from '@/components/data-table/table';
import type { CheckRow } from '@/utils/cases/ReportChecks';
import { checkResults } from '@/validations/ReportValidation';

function Heading(props: { id: 'claim' | 'result' | 'evidence' }) {
  const t = useTranslations('Report');

  return t(`${props.id}_label`);
}

const helper = createAppColumnHelper<CheckRow>();

const columns = helper.columns([
  helper.accessor('claim', {
    id: 'claim',
    header: () => <Heading id="claim" />,
    cell: ({ getValue }) => <p className="min-w-48 whitespace-normal">{getValue()}</p>,
  }),
  helper.accessor('result', {
    id: 'result',
    header: () => <Heading id="result" />,
    cell: ({ getValue }) => <ResultBadge result={getValue()} />,
    filterFn: 'inSet',
  }),
  helper.accessor('evidence', {
    id: 'evidence',
    header: () => <Heading id="evidence" />,
    cell: ({ getValue }) => <p className="min-w-64 whitespace-normal">{getValue()}</p>,
  }),
]);

/**
 * What a report checked, as one table: a row for each thing the platform said, with the result and what the chain shows. The case
 * page and the staff view both use it. The columns are fixed, so it is the
 * app's own table, sortable by result. With a search placeholder it also gets search and a filter on the result.
 * @param props - The table props.
 * @param props.rows - The checks.
 * @param props.searchPlaceholder - Turns on the search and the result filter, for a long list of checks.
 * @returns The table.
 */
export function CheckTable(props: { rows: CheckRow[]; searchPlaceholder?: string }) {
  const t = useTranslations('Report');
  const searchable = props.searchPlaceholder !== undefined;

  return (
    <DataTable
      columns={columns}
      data={props.rows}
      getRowId={(row) => row.id}
      toolbar={searchable}
      pagination={searchable}
      pageSize={searchable ? 25 : 20}
      searchPlaceholder={props.searchPlaceholder}
      labels={{
        claim: t('claim_label'),
        result: t('result_label'),
        evidence: t('evidence_label'),
      }}
      filters={[
        {
          columnId: 'result',
          title: t('result_label'),
          options: checkResults.map((value) => ({ value, label: t(`result_${value}`) })),
        },
      ]}
    />
  );
}
