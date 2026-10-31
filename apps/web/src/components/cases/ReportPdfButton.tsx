import { DownloadSimpleIcon } from '@phosphor-icons/react/ssr';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { getI18nPath } from '@/utils/Helpers';

/**
 * The button that downloads a report as a PDF. It is a plain form, not a Link: the answer is a file, so the browser has to make
 * the request itself and not the router.
 * @param props - The button props.
 * @param props.caseId - The case id.
 * @param props.version - The report version to download.
 * @returns The button.
 */
export function ReportPdfButton(props: { caseId: string; version: number }) {
  const t = useTranslations('Report');
  const locale = useLocale();

  return (
    <form action={getI18nPath(`/dashboard/cases/${props.caseId}/analysis/pdf`, locale)}>
      <input type="hidden" name="version" value={props.version} />
      <Button type="submit" variant="outline">
        <DownloadSimpleIcon aria-hidden="true" />
        {t('pdf_download')}
      </Button>
    </form>
  );
}
