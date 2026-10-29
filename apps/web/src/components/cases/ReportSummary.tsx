import { useFormatter, useTranslations } from 'next-intl';
import { CheckTable } from '@/components/cases/CheckTable';
import { ReportTable } from '@/components/cases/ReportTable';
import { StatCard } from '@/components/overview/StatCard';
import { Button } from '@/components/ui/button';
import type { ReportView } from '@/libs/cases/Reports';
import { Link } from '@/libs/I18nNavigation';
import { checkRows } from '@/utils/cases/ReportChecks';

const checksOnCasePage = 2;

/**
 * The headline figures of a report as cards, such as the wallets affected and the estimated loss. The case page shows them at the
 * top with the other summary numbers; the report itself shows them where it has no other summary above it.
 * @param props - The cards props.
 * @param props.figures - The report's figures.
 * @returns The cards, or nothing when the report has no figures.
 */
export function ReportFigures(props: { figures: ReportView['snapshot']['figures'] }) {
  if (props.figures.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {props.figures.map((figure) => (
        <StatCard
          key={figure.label}
          size="sm"
          label={figure.label}
          value={figure.value}
          hint={figure.note}
        />
      ))}
    </div>
  );
}

/**
 * A case's analysis report: what the chain shows and what it does not, check by check. The full analysis adds the method, the
 * commitment and the hash, so a lawyer can verify it. It declares no fraud, and holds public facts only. The case page and the preview dialog both show it.
 * @param props - The summary props.
 * @param props.report - The saved report.
 * @param props.caseId - The case the report belongs to, for links into its full analysis.
 * @param props.full - Show every test's output in place, as on the analysis page. Otherwise tests link to it.
 * @param props.hideFigures - Leave the figures out, because the page already shows them above.
 * @returns The summary.
 */
export function ReportSummary(props: {
  report: ReportView;
  caseId: string;
  full?: boolean;
  hideFigures?: boolean;
}) {
  const t = useTranslations('Report');
  const format = useFormatter();
  const { snapshot, hash } = props.report;
  const analysis = `/dashboard/cases/${props.caseId}/analysis`;
  // On the analysis page a test is on the same page; elsewhere it is a link into that page.
  const testHref = (id: string) =>
    props.full ? `#test-${id}` : `${analysis}?version=${props.report.version}#test-${id}`;
  // The case page shows the first two checks; the full analysis shows all of them.
  const shownChecks = props.full ? snapshot.checks : snapshot.checks.slice(0, checksOnCasePage);
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <div className="grid gap-8">
      {props.full && <p className="text-base">{snapshot.headline}</p>}

      {!props.hideFigures && <ReportFigures figures={snapshot.figures} />}

      <section className="grid gap-4">
        <CheckTable rows={checkRows({ checks: shownChecks, tests: snapshot.tests }, testHref)} />
        {shownChecks.length < snapshot.checks.length && (
          <div className="flex flex-wrap items-center gap-4 border border-border bg-paper-sunken p-4">
            <p className="flex-1 text-sm">
              {t('checks_more', { shown: shownChecks.length, total: snapshot.checks.length })}
            </p>
            <Button asChild>
              <Link href={`${analysis}?version=${props.report.version}`}>
                {t('checks_all', { total: snapshot.checks.length })}
              </Link>
            </Button>
          </div>
        )}
      </section>

      {props.full && (
        <section className="grid gap-3">
          <h3 className="text-lg">{t('method_title')}</h3>
          <ul className="list-disc pl-5">
            {snapshot.tests.map((test) => (
              <li key={test.id}>
                <a
                  href={testHref(test.id)}
                  className="underline underline-offset-4 focus-ring hover:text-ink-muted"
                >
                  {test.title}
                </a>
              </li>
            ))}
          </ul>
          <dl className="grid gap-2 text-sm">
            {snapshot.method.commitment && (
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="text-ink-muted">{t('commitment_label')}</dt>
                <dd className="font-mono break-all">{snapshot.method.commitment}</dd>
              </div>
            )}
            {snapshot.method.notebookUrl && (
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="text-ink-muted">{t('notebook_label')}</dt>
                <dd>
                  <a
                    href={snapshot.method.notebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4 focus-ring hover:text-ink-muted"
                  >
                    {t('notebook_link')}
                  </a>
                </dd>
              </div>
            )}
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-muted">{t('hash_label')}</dt>
              <dd className="font-mono break-all">{hash}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-muted">{t('data_as_of_label')}</dt>
              <dd>{date(snapshot.dataAsOf)}</dd>
            </div>
            {snapshot.sources.length > 0 && (
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="text-ink-muted">{t('sources_label')}</dt>
                <dd>{snapshot.sources.join(', ')}</dd>
              </div>
            )}
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-muted">{t('version_label')}</dt>
              <dd>
                {t('version_value', {
                  version: props.report.version,
                  date: date(props.report.savedAt),
                })}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {props.full && (
        <section className="grid gap-6">
          <h3 className="text-lg">{t('tests_title')}</h3>
          {snapshot.tests.map((test) => (
            <div key={test.id} id={`test-${test.id}`} className="grid scroll-mt-24 gap-3">
              <h4 className="text-base font-medium">{test.title}</h4>
              <p>{test.summary}</p>
              {test.columns && test.rows && test.rows.length > 0 ? (
                <ReportTable columns={test.columns} rows={test.rows} label={test.title} />
              ) : (
                <p className="border border-dashed border-border p-4 text-sm text-ink-muted">
                  {t('no_table')}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <p className="text-sm text-ink-muted">{t('disclaimer')}</p>
    </div>
  );
}
