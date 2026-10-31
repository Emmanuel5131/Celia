import { currentUser } from '@clerk/nextjs/server';
import { getFormatter, getTranslations } from 'next-intl/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as z from 'zod';
import { readCaseAccess } from '@/libs/accounts/CaseAccess';
import { canOpenReport } from '@/libs/analysis/Research';
import { getCase } from '@/libs/cases/Cases';
import { renderReportPdf } from '@/libs/cases/ReportPdf';
import { getReport } from '@/libs/cases/Reports';
import { routing } from '@/libs/I18nRouting';
import { parseAccount } from '@/utils/accounts/Account';
import { reportPdfName } from '@/utils/cases/ReportPdf';

const notFound = () => new NextResponse('Not found', { status: 404 });

/**
 * Downloads one analysis's saved report as a PDF, in the language of the page it was asked from. It follows the full-analysis page's own
 * rules: you must be signed in with an account, and the report is the same one that page shows, so the PDF holds nothing the page
 * does not. Anyone else, an unknown case, or a case without a report gets a 404.
 * @param request - The request, with an optional `version` in the query (the newest by default).
 * @param context - The route parameters.
 * @param context.params - The locale, the case id and the analysis run.
 * @returns The PDF as a download, or 404.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string; id: string; run: string }> },
) {
  const { locale, id, run } = await context.params;
  const user = await currentUser();

  // The pages are for people who have said what they are, so the file is too.
  if (!user || !parseAccount(user.publicMetadata) || !z.uuid().safeParse(id).success) {
    return notFound();
  }

  const found = await getCase(id);
  const asked = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(request.nextUrl.searchParams.get('version') ?? undefined);
  const asRun = z.coerce.number().int().positive().safeParse(run);
  const access = await readCaseAccess();
  const report =
    found && asRun.success && (await canOpenReport(found.id, asRun.data, access))
      ? await getReport(found.id, {
          run: asRun.data,
          version: asked.success ? asked.data : undefined,
        })
      : null;

  if (!found || !report) {
    return notFound();
  }

  const language = routing.locales.find((item) => item === locale) ?? routing.defaultLocale;
  const t = await getTranslations({ locale: language, namespace: 'Report' });
  const format = await getFormatter({ locale: language });
  const day = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  const pdf = await renderReportPdf({
    name: found.name,
    number: found.number,
    report,
    dataAsOf: day(report.snapshot.dataAsOf),
    labels: {
      kind: t('tests_label'),
      version: `${t('version_label')} ${t('version_value', { version: report.version, date: day(report.savedAt) })}`,
      claim: t('claim_label'),
      evidence: t('evidence_label'),
      result: t('result_label'),
      results: {
        proven: t('result_proven'),
        proven_false: t('result_proven_false'),
        partly_proven: t('result_partly_proven'),
        not_proven: t('result_not_proven'),
        not_checkable: t('result_not_checkable'),
      },
      testsTitle: t('tests_title'),
      noTable: t('no_table'),
      method: t('method_title'),
      hash: t('hash_label'),
      commitment: t('commitment_label'),
      notebook: t('notebook_label'),
      dataAsOf: t('data_as_of_label'),
      sources: t('sources_label'),
      disclaimer: t('disclaimer'),
      // Each page fills in its own number and the total.
      page: t('pdf_page', { page: '{{page}}', total: '{{total}}' }),
    },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${reportPdfName(found.number, report.run, report.version)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
