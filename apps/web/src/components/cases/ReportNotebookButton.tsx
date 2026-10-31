import { ArrowSquareOutIcon } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { ReportView } from '@/libs/cases/Reports';

/**
 * The link to the one notebook a report came from. Every report is attached to a single notebook, so there is one link for the
 * whole report and none for a check or a test.
 * @param props - The button props.
 * @param props.report - The saved report.
 * @returns The button, or nothing for a report saved before notebooks were required.
 */
export function ReportNotebookButton(props: { report: ReportView }) {
  const t = useTranslations('Report');
  const url = props.report.snapshot.method.notebookUrl;

  if (!url) {
    return null;
  }

  return (
    <Button asChild variant="outline">
      <a href={url} target="_blank" rel="noopener noreferrer">
        {t('notebook_link')}
        <ArrowSquareOutIcon aria-hidden="true" />
      </a>
    </Button>
  );
}
