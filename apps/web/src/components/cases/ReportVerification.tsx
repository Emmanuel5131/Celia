import { ArrowSquareOutIcon } from '@phosphor-icons/react/ssr';
import { useFormatter, useTranslations } from 'next-intl';
import { CopyButton } from '@/components/cases/CopyButton';
import { PageSection } from '@/components/layout/PageSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReportView } from '@/libs/cases/Reports';

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-soft py-4 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-sm text-ink-muted">{props.label}</dt>
      <dd className="min-w-0 text-sm">{props.children}</dd>
    </div>
  );
}

function Hash(props: { value: string }) {
  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 pt-1 font-mono text-xs break-all">{props.value}</code>
      <CopyButton value={props.value} />
    </div>
  );
}

/**
 * What someone needs to check a report for themselves, in one place: the hash that identifies exactly these findings, the hash of
 * the plan approved before the analysis ran, the notebook it ran in, when the chain was read, the sources, and the version.
 * @param props - The section props.
 * @param props.report - The saved report.
 * @returns The section.
 */
export function ReportVerification(props: { report: ReportView }) {
  const t = useTranslations('Report');
  const format = useFormatter();
  const { snapshot, hash } = props.report;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <PageSection title={t('method_title')} description={t('verify_text')}>
      <Card variant="outline" size="sm">
        <CardContent>
          <dl>
            <Row label={t('hash_label')}>
              <Hash value={hash} />
            </Row>
            {snapshot.method.commitment && (
              <Row label={t('commitment_label')}>
                <Hash value={snapshot.method.commitment} />
              </Row>
            )}
            <Row label={t('notebook_label')}>
              {snapshot.method.notebookUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={snapshot.method.notebookUrl} target="_blank" rel="noopener noreferrer">
                    {t('notebook_link')}
                    <ArrowSquareOutIcon aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <span className="text-ink-muted">{t('notebook_none')}</span>
              )}
            </Row>
            <Row label={t('data_as_of_label')}>{date(snapshot.dataAsOf)}</Row>
            {snapshot.sources.length > 0 && (
              <Row label={t('sources_label')}>
                <ul className="grid gap-1">
                  {snapshot.sources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </Row>
            )}
            <Row label={t('version_label')}>
              {t('version_value', {
                version: props.report.version,
                date: date(props.report.savedAt),
              })}
            </Row>
          </dl>
        </CardContent>
      </Card>
    </PageSection>
  );
}
