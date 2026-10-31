import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * The output of one test in a report, as a read-only grid. It is not a `DataTable`: the columns come from the report itself and
 * change with every test, so there is nothing to define at module scope, and nothing to sort, filter or select. It is the one
 * table in the app built from data the code has never seen.
 * @param props - The table props.
 * @param props.columns - The column headings.
 * @param props.rows - The rows, each as long as the headings.
 * @param props.label - What the table is, for screen readers.
 * @returns The table.
 */
export function ReportTable(props: { columns: string[]; rows: string[][]; label: string }) {
  return (
    // A table of two or three columns stays narrow, so a value sits near its label instead of at the far edge of the page.
    <div
      className={
        props.columns.length <= 3 ? 'max-w-3xl border border-border' : 'border border-border'
      }
    >
      <Table aria-label={props.label}>
        <TableHeader>
          <TableRow>
            {props.columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.join('|')}>
              {row.map((cell, index) => (
                <TableCell key={`${props.columns[index]}-${cell}`}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
