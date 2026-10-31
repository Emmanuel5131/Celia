/**
 * One tab of a case's lists: a single line on what the list holds, the add button on the right, then the table.
 * @param props - The panel props.
 * @param props.description - One line on what the list holds.
 * @param props.action - The add button.
 * @param props.children - The table, or the note that it is empty.
 * @returns The panel.
 */
export function ListPanel(props: {
  description: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-sm text-ink-muted">{props.description}</p>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}
