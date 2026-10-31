import { useTranslations } from 'next-intl';
import { CheckTable } from '@/components/cases/CheckTable';
import { ReportChart } from '@/components/cases/ReportChart';
import { ReportTable } from '@/components/cases/ReportTable';
import { ReportVerification } from '@/components/cases/ReportVerification';
import { PageSection } from '@/components/layout/PageSection';
import { StatCard } from '@/components/overview/StatCard';
import type { ReportView } from '@/libs/cases/Reports';
import { checkRows } from '@/utils/cases/ReportChecks';

/**
 * The headline figures of a report as cards, such as the wallets affected and the estimated loss. The case page shows them at the
 * top with the other summary numbers; the report itself shows them where it has no other summary above it.
 * @param props - The cards props.
 * @param props.figures - The report's figures.
 * @param props.wide - Put them in one row on a wide screen, for a page that has the room.
 * @returns The cards, or nothing when the report has no figures.
 */
export function ReportFigures(props: {
  figures: ReportView['snapshot']['figures'];
  wide?: boolean;
}) {
  if (props.figures.length === 0) {
    return null;
  }

  return (
    <div
      className={
        props.wide ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'grid gap-4 sm:grid-cols-2'
      }
    >
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
 * One analysis report: the one statement of the platform it checks, what the chain shows and what it does not, the tests behind
 * it with their charts and tables, and the method, the commitment and the hash, so a lawyer can verify it. It declares no fraud,
 * and holds public facts only.
 * @param props - The summary props.
 * @param props.report - The saved report.
 * @param props.hideFigures - Leave the figures out, because the page already shows them above.
 * @returns The summary.
 */
export function ReportSummary(props: { report: ReportView; hideFigures?: boolean }) {
  const t = useTranslations('Report');
  const { snapshot } = props.report;

  return (
    <div className="grid gap-12">
      <p className="max-w-prose text-lg">{snapshot.headline}</p>

      {!props.hideFigures && <ReportFigures figures={snapshot.figures} wide />}

      <PageSection title={t('checks_title')}>
        <CheckTable rows={checkRows({ checks: snapshot.checks })} />
      </PageSection>

      <PageSection title={t('tests_title')}>
        <nav aria-label={t('tests_jump')}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {snapshot.tests.map((test) => (
              <li key={test.id}>
                <a
                  href={`#test-${test.id}`}
                  className="underline underline-offset-4 focus-ring hover:text-ink-muted"
                >
                  {test.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-10">
          {snapshot.tests.map((test) => (
            <div key={test.id} id={`test-${test.id}`} className="grid scroll-mt-24 gap-3">
              <h3 className="text-lg">{test.title}</h3>
              <p className="max-w-prose text-sm text-ink-muted">{test.summary}</p>
              {test.charts?.map((chart) => (
                <ReportChart key={chart.title ?? chart.series[0]?.name} chart={chart} />
              ))}
              {test.columns && test.rows && test.rows.length > 0 ? (
                <ReportTable columns={test.columns} rows={test.rows} label={test.title} />
              ) : (
                <p className="border border-dashed border-border p-4 text-sm text-ink-muted">
                  {t('no_table')}
                </p>
              )}
              {test.notes && test.notes.length > 0 && (
                <ul className="grid max-w-prose list-disc gap-1 pl-5 text-sm text-ink-muted">
                  {test.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </PageSection>

      <ReportVerification report={props.report} />

      <p className="text-sm text-ink-muted">{t('disclaimer')}</p>
    </div>
  );
}
