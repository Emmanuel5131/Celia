import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReportView } from '@/libs/cases/Reports';
import { pdfSafe } from '@/utils/cases/ReportPdf';
import type { CheckResult } from '@/validations/ReportValidation';

// The colours are the Celia tokens (docs/DESIGN.md §2). A PDF has no stylesheet to read them from, so they are written out here once.
const color = {
  ink: '#0F1B2D',
  muted: '#46566E',
  line: '#C4C8CF',
  paper: '#F5F2EA',
  seal: '#991F38',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 64,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: color.ink,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  kind: { fontSize: 9, color: color.muted },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  meta: { fontSize: 9, color: color.muted, marginBottom: 16 },
  headline: {
    backgroundColor: color.paper,
    padding: 12,
    fontSize: 11,
    lineHeight: 1.4,
    marginBottom: 16,
  },
  figures: { flexDirection: 'row', marginBottom: 20 },
  figure: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.75,
    borderColor: color.line,
    padding: 8,
    marginRight: 8,
  },
  figureLabel: { fontSize: 8, color: color.muted, marginBottom: 3 },
  figureValue: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  figureNote: { fontSize: 7, color: color.muted, marginTop: 2 },
  heading: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 8 },
  table: { borderWidth: 0.75, borderColor: color.line, marginBottom: 16 },
  row: { flexDirection: 'row', borderTopWidth: 0.75, borderTopColor: color.line },
  headRow: { flexDirection: 'row', backgroundColor: color.paper },
  cell: { padding: 6 },
  // react-pdf multiplies a unitless line height by the font size set on the text itself, not the one it inherits, so each style that
  // sets one also sets its size.
  cellText: { fontSize: 9, lineHeight: 1.3 },
  head: { fontSize: 8, color: color.muted, fontFamily: 'Helvetica-Bold' },
  test: { marginBottom: 12 },
  testTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  testSummary: { fontSize: 9, color: color.muted, marginBottom: 6, lineHeight: 1.35 },
  term: { fontSize: 8, color: color.muted, marginBottom: 1 },
  value: { fontSize: 9, marginBottom: 7, lineHeight: 1.35 },
  mono: { fontFamily: 'Courier', fontSize: 7.5 },
  footer: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: color.line,
    paddingTop: 6,
  },
  disclaimer: {
    flexGrow: 1,
    flexBasis: 0,
    fontSize: 7,
    color: color.muted,
    paddingRight: 16,
    lineHeight: 1.3,
  },
  page_number: { fontSize: 7, color: color.muted },
});

/** The words in the PDF, already translated. `page` holds `{{page}}` and `{{total}}`, filled in as each page is drawn. */
export type ReportPdfLabels = {
  kind: string;
  /** The version and when it was saved, such as `Version 1, saved Oct 31, 2026`. */
  version: string;
  claim: string;
  evidence: string;
  result: string;
  results: Record<CheckResult, string>;
  testsTitle: string;
  noTable: string;
  method: string;
  hash: string;
  commitment: string;
  notebook: string;
  dataAsOf: string;
  sources: string;
  disclaimer: string;
  page: string;
};

const resultColor = (result: CheckResult) => (result === 'not_proven' ? color.seal : color.ink);

function Cell(props: { width: string; children: React.ReactNode }) {
  return <View style={[styles.cell, { width: props.width }]}>{props.children}</View>;
}

function ChecksTable(props: { report: ReportView; labels: ReportPdfLabels }) {
  const { labels } = props;

  return (
    <View style={styles.table}>
      <View style={styles.headRow} fixed>
        <Cell width="38%">
          <Text style={styles.head}>{labels.claim}</Text>
        </Cell>
        <Cell width="14%">
          <Text style={styles.head}>{labels.result}</Text>
        </Cell>
        <Cell width="48%">
          <Text style={styles.head}>{labels.evidence}</Text>
        </Cell>
      </View>
      {props.report.snapshot.checks.map((check) => (
        <View key={check.claim} style={styles.row} wrap={false}>
          <Cell width="38%">
            <Text style={styles.cellText}>{pdfSafe(check.claim)}</Text>
          </Cell>
          <Cell width="14%">
            <Text
              style={[
                styles.cellText,
                { fontFamily: 'Helvetica-Bold', color: resultColor(check.result) },
              ]}
            >
              {labels.results[check.result]}
            </Text>
          </Cell>
          <Cell width="48%">
            <Text style={styles.cellText}>{pdfSafe(check.evidence)}</Text>
            {check.proof?.map((proof) => (
              <Link
                key={proof.url}
                src={proof.url}
                style={{ color: color.muted, fontSize: 8, marginTop: 3 }}
              >
                {pdfSafe(proof.label)}
              </Link>
            ))}
          </Cell>
        </View>
      ))}
    </View>
  );
}

function TestTable(props: {
  test: ReportView['snapshot']['tests'][number];
  labels: ReportPdfLabels;
}) {
  const { test } = props;
  const width = `${100 / (test.columns?.length ?? 1)}%`;

  return (
    <View style={styles.test} wrap={(test.rows?.length ?? 0) > 14}>
      <View wrap={false}>
        <Text style={styles.testTitle}>{pdfSafe(test.title)}</Text>
        <Text style={styles.testSummary}>{pdfSafe(test.summary)}</Text>
      </View>
      {test.columns && test.rows ? (
        <View style={styles.table}>
          <View style={styles.headRow} wrap={false}>
            {test.columns.map((column) => (
              <Cell key={column} width={width}>
                <Text style={styles.head}>{pdfSafe(column)}</Text>
              </Cell>
            ))}
          </View>
          {test.rows.map((row) => (
            <View key={row.join('|')} style={styles.row} wrap={false}>
              {row.map((value, index) => (
                // The column names are unique within a test, so a position within a row is a stable key.
                <Cell key={test.columns?.[index] ?? index} width={width}>
                  <Text style={styles.cellText}>{pdfSafe(value)}</Text>
                </Cell>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.testSummary}>{props.labels.noTable}</Text>
      )}
    </View>
  );
}

function Fact(props: { term: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={styles.term}>{props.term}</Text>
      {props.children}
    </View>
  );
}

/**
 * A saved case report as a PDF: the headline and figures, every check with its result, every test with its table, and the facts that
 * let anyone verify it (the report's hash, the method commitment, the notebook and the sources). Every page carries the disclaimer
 * and its number. It holds exactly what the saved report holds, so it carries no more than the report page shows.
 * @param props - The document props.
 * @param props.name - The case name.
 * @param props.number - The case number, such as `CB-1001`.
 * @param props.report - The saved report version to print.
 * @param props.dataAsOf - When the chain was read, already formatted.
 * @param props.labels - The words, already translated.
 * @returns The document.
 */
export function ReportPdfDocument(props: {
  name: string;
  number: string;
  report: ReportView;
  dataAsOf: string;
  labels: ReportPdfLabels;
}) {
  const { report, labels } = props;
  const { snapshot } = report;

  return (
    <Document title={pdfSafe(`${props.name} ${props.number}`)} author="Celia" creator="Celia">
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.brand}>celia</Text>
          <Text style={styles.kind}>{labels.kind}</Text>
        </View>
        <Text style={styles.title}>{pdfSafe(props.name)}</Text>
        <Text style={styles.meta}>
          {props.number} · {labels.version}
        </Text>
        <Text style={styles.headline}>{pdfSafe(snapshot.headline)}</Text>
        {snapshot.figures.length > 0 && (
          <View style={styles.figures}>
            {snapshot.figures.map((figure) => (
              <View key={figure.label} style={styles.figure}>
                <Text style={styles.figureLabel}>{pdfSafe(figure.label)}</Text>
                <Text style={styles.figureValue}>{pdfSafe(figure.value)}</Text>
                {figure.note && <Text style={styles.figureNote}>{pdfSafe(figure.note)}</Text>}
              </View>
            ))}
          </View>
        )}
        <ChecksTable report={report} labels={labels} />
        {/* A heading stays with its first table: with less than a short table's room left on the page, it moves to the next. */}
        <Text style={styles.heading} minPresenceAhead={340}>
          {labels.testsTitle}
        </Text>
        {snapshot.tests.map((test) => (
          <TestTable key={test.id} test={test} labels={labels} />
        ))}
        <Text style={styles.heading} minPresenceAhead={90}>
          {labels.method}
        </Text>
        <Fact term={labels.hash}>
          <Text style={[styles.value, styles.mono]}>{report.hash}</Text>
        </Fact>
        {snapshot.method.commitment && (
          <Fact term={labels.commitment}>
            <Text style={[styles.value, styles.mono]}>{snapshot.method.commitment}</Text>
          </Fact>
        )}
        {snapshot.method.notebookUrl && (
          <Fact term={labels.notebook}>
            <Link src={snapshot.method.notebookUrl} style={[styles.value, { color: color.ink }]}>
              {snapshot.method.notebookUrl}
            </Link>
          </Fact>
        )}
        <Fact term={labels.dataAsOf}>
          <Text style={styles.value}>{props.dataAsOf}</Text>
        </Fact>
        {snapshot.sources.length > 0 && (
          <Fact term={labels.sources}>
            <Text style={styles.value}>{pdfSafe(snapshot.sources.join(' · '))}</Text>
          </Fact>
        )}
        <View style={styles.footer} fixed>
          <Text style={styles.disclaimer}>{labels.disclaimer}</Text>
          <Text
            style={styles.page_number}
            render={({ pageNumber, totalPages }) =>
              labels.page
                .replace('{{page}}', String(pageNumber))
                .replace('{{total}}', String(totalPages))
            }
          />
        </View>
      </Page>
    </Document>
  );
}
