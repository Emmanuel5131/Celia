import { renderToBuffer } from '@react-pdf/renderer';
import type * as React from 'react';
import { ReportPdfDocument } from '@/components/cases/ReportPdfDocument';

/**
 * Draws a saved report as a PDF.
 * @param props - What the document needs: the case, the report and the translated words.
 * @returns The PDF file's bytes.
 */
export async function renderReportPdf(props: React.ComponentProps<typeof ReportPdfDocument>) {
  return await renderToBuffer(<ReportPdfDocument {...props} />);
}
