// A PDF's built-in fonts hold Latin-1 and a few typographic marks, and nothing else. Any other character would draw as a blank or
// break the file, so it is replaced with a question mark: the PDF always renders, and a missing glyph is visible, not silent.
const supported = /[ -~ -ÿ‘’“”–—…•€™\n]/u;

/**
 * Makes text safe to draw with a PDF's built-in fonts.
 * @param text - Any text from the report.
 * @returns The text with every character the fonts cannot draw replaced by `?`.
 */
export function pdfSafe(text: string) {
  // `Array.from` walks code points, so an emoji is one character and becomes one question mark, not two.
  return Array.from(text, (char) => (supported.test(char) ? char : '?')).join('');
}

/**
 * The name a downloaded report is saved under, such as `celia-cb-1001-report-v2.pdf`.
 * @param caseNumber - The case number, such as `CB-1001`.
 * @param version - The report version.
 * @returns The file name.
 */
export function reportPdfName(caseNumber: string, version: number) {
  const slug = caseNumber
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

  return `celia-${slug || 'case'}-report-v${version}.pdf`;
}
