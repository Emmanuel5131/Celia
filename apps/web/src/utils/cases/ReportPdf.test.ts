import { describe, expect, it } from 'vitest';
import { pdfSafe, reportPdfName } from './ReportPdf';

describe(pdfSafe, () => {
  it('keeps plain text, accents and typographic quotes', () => {
    expect(pdfSafe('Réclamation “vérifiée” — 6.25 ETH')).toBe('Réclamation “vérifiée” — 6.25 ETH');
  });

  it('replaces a character the fonts cannot draw', () => {
    expect(pdfSafe('A → B')).toBe('A ? B');
  });

  it('keeps line breaks', () => {
    expect(pdfSafe('one\ntwo')).toBe('one\ntwo');
  });

  it('replaces a whole character, not half of it', () => {
    expect(pdfSafe('x😀y')).toBe('x?y');
  });
});

describe(reportPdfName, () => {
  it('names the file after the case and the version', () => {
    expect(reportPdfName('CB-1001', 2)).toBe('celia-cb-1001-report-v2.pdf');
  });

  it('never leaves a character a file name cannot hold', () => {
    expect(reportPdfName('CB 10/01', 1)).toBe('celia-cb-10-01-report-v1.pdf');
  });

  it('falls back when the number has no letters or digits', () => {
    expect(reportPdfName('///', 1)).toBe('celia-case-report-v1.pdf');
  });
});
