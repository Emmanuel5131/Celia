import { describe, expect, it } from 'vitest';
import type { ReportPdfLabels } from '@/components/cases/ReportPdfDocument';
import { renderReportPdf } from './ReportPdf';
import type { ReportView } from './Reports';

const labels: ReportPdfLabels = {
  kind: 'Analysis report',
  version: 'Version 1, saved Oct 31, 2026',
  claim: 'The platform said',
  evidence: 'The chain shows',
  result: 'Result',
  results: {
    proven: 'Proven true',
    proven_false: 'Proven false',
    partly_proven: 'Partly proven',
    not_proven: 'Not proven',
    not_checkable: 'Not on chain',
  },
  testsTitle: 'Tests and their output',
  noTable: 'This test has no table.',
  method: 'Method',
  hash: 'Report hash',
  commitment: 'Method commitment',
  notebook: 'Verify it yourself',
  dataAsOf: 'Data as of',
  sources: 'Sources',
  disclaimer: 'This report states what the chain shows and what it does not.',
  page: 'Page {{page}} of {{total}}',
};

const report = (rows: string[][], headline = 'The chain shows money in and out.'): ReportView => ({
  analysisId: 'a1',
  run: 1,
  version: 1,
  hash: `0x${'ab'.repeat(32)}`,
  savedAt: '2026-10-31T10:00:00Z',
  review: 'approved',
  agentReview: null,
  snapshot: {
    version: 1,
    headline,
    figures: [{ label: 'Wallets', value: '30' }],
    checks: [
      {
        claim: 'Withdrawals are always available.',
        evidence: 'Payouts were made.',
        result: 'proven',
      },
    ],
    tests: [
      {
        id: 'money',
        title: 'Money in and out',
        summary: 'A summary.',
        columns: ['Measure', 'Value'],
        rows,
      },
    ],
    method: { commitment: `0x${'cd'.repeat(32)}` },
    dataAsOf: '2026-10-31T10:00:00Z',
    sources: ['Public chain data'],
  },
});

const pages = (pdf: Buffer) =>
  pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/gu)?.length ?? 0;

const render = async (view: ReportView) =>
  await renderReportPdf({
    name: 'Forsage SmartWay',
    number: 'CB-1001',
    report: view,
    dataAsOf: 'Oct 31, 2026',
    labels,
  });

describe(renderReportPdf, () => {
  it('draws a PDF file', async () => {
    const pdf = await render(report([['Wallets that paid in', '30']]));

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(pdf)).toBe(1);
  });

  it('flows a long report onto more pages', async () => {
    const rows = Array.from({ length: 50 }, (_, index) => [`Measure ${index}`, String(index)]);

    expect(pages(await render(report(rows)))).toBeGreaterThan(1);
  });

  it('still draws a report with characters the fonts cannot hold', async () => {
    const pdf = await render(report([['A → B 😀', '1']], 'Money moved → elsewhere 😀'));

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
