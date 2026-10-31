import { createHash } from 'node:crypto';
import { NewReportValidation } from '@/validations/ReportValidation';
import type { Report } from '@/validations/ReportValidation';

/**
 * Writes JSON with the keys of every object in sorted order, so the same findings always give the same text, however the
 * source ordered its keys.
 * @param value - Any JSON value.
 * @returns The canonical JSON text.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

const dollars = /^\s*(?:US)?\$\s*(\d[\d,]*(?:\.\d+)?)\s*([kmb])?\s*$/iu;
const multipliers = { k: 1000, m: 1_000_000, b: 1_000_000_000 } as const;

/**
 * Reads a dollar amount written as text, such as `$834,000`, `$1.2M` or `$12k`. Anything else, such as an amount in a token, is not
 * guessed at.
 * @param text - The amount as written in the report.
 * @returns Whole US dollars, or null when the text is not a dollar amount.
 */
export function parseDollars(text: string | undefined) {
  const match = dollars.exec(text ?? '');

  if (!match?.[1]) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === 'k' || suffix === 'm' || suffix === 'b' ? multipliers[suffix] : 1;

  return Math.round(Number(match[1].replaceAll(',', '')) * multiplier);
}

/**
 * The hash of a report: SHA-256 of its canonical JSON. Anyone holding the findings can recompute it and compare, so a stored
 * report that was changed no longer matches the hash shown with it.
 * @param report - The findings.
 * @returns The hash as `0x` and 64 hex characters.
 */
export function hashReport(report: unknown) {
  return `0x${createHash('sha256').update(canonicalJson(report)).digest('hex')}`;
}

/**
 * The description of a case, written from its report and saved on the case: the estimate on the first line, then up to two
 * statements the chain shows to be false, each beside what the platform said. It states findings only, never a verdict.
 * @param report - The case's report.
 * @returns The description, or null when the report has neither an estimate nor a proven finding.
 */
export function describeCase(report: Report) {
  const { estimate, checks } = report;
  const lines = checks
    .filter((check) => check.result === 'proven_false')
    .slice(0, 2)
    .map((check) => `The platform said: ${check.claim} ${check.evidence}`);

  if (estimate) {
    lines.unshift(
      `${estimate.wallets} wallets, estimated loss of ${estimate.losses} to this platform.`,
    );
  }

  return lines.length > 0 ? lines.join('\n\n') : null;
}

/**
 * Checks findings against what a new report must satisfy: the report format, the house language, a table for every test and a
 * loss that can be read as dollars. The loss decides when a case starts building evidence, so a report that gives none is refused,
 * not saved with no effect.
 * @param json - The findings as parsed JSON.
 * @returns The report, or the problem: `schema`, `words`, `table` (a test has no table), `notebook` (no notebook link), `one_check` (more or fewer than one check), `analysis` (no commitment) or `loss`.
 */
export function readNewReport(
  json: unknown,
):
  | { report: Report }
  | { problem: 'schema' | 'words' | 'table' | 'notebook' | 'one_check' | 'analysis' | 'loss' } {
  const parsed = NewReportValidation.safeParse(json);

  if (!parsed.success) {
    const messages = new Set(parsed.error.issues.map((issue) => issue.message));

    if (messages.has('forbidden_words')) {
      return { problem: 'words' };
    }

    if (messages.has('table_required')) {
      return { problem: 'table' };
    }

    if (messages.has('notebook_required')) {
      return { problem: 'notebook' };
    }

    if (messages.has('one_check')) {
      return { problem: 'one_check' };
    }

    return { problem: messages.has('commitment_required') ? 'analysis' : 'schema' };
  }

  const { estimate } = parsed.data;

  if (estimate && (estimate.lossUsd ?? parseDollars(estimate.losses)) === null) {
    return { problem: 'loss' };
  }

  return { report: parsed.data };
}
