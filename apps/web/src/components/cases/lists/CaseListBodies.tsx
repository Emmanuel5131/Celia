import { currentUser } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { ActionsTable } from '@/components/cases/ActionsTable';
import { CaseClaimantsTable } from '@/components/cases/CaseClaimantsTable';
import { LockedList } from '@/components/cases/CaseLocked';
import { OperatorsTable } from '@/components/cases/OperatorsTable';
import { ResearchTable } from '@/components/cases/ResearchTable';
import { EvidenceTable } from '@/components/staff/EvidenceTable';
import { readCaseAccess } from '@/libs/accounts/CaseAccess';
import { listEvidence } from '@/libs/analysis/Evidence';
import { listResearch } from '@/libs/analysis/Research';
import { listActions } from '@/libs/cases/Actions';
import { canViewCaseClaims } from '@/libs/cases/CaseClaims';
import { getCase } from '@/libs/cases/Cases';
import { loadClaimantRows } from '@/libs/cases/ClaimantRows';
import { parseAccount } from '@/utils/accounts/Account';
import { actionRows } from '@/utils/cases/Actions';
import { researchRows } from '@/utils/cases/ResearchRows';

/**
 * Finds the case for a list's page, or shows "not found" for an id that is not a case.
 * @param caseId - The case id from the address.
 * @returns The case.
 */
async function caseOrNotFound(caseId: string) {
  const found = z.uuid().safeParse(caseId).success ? await getCase(caseId) : undefined;

  if (!found) {
    notFound();
  }

  return found;
}

/**
 * Stops a full list for a reader who may only see the first rows. It runs before the list is read, so for them nothing is fetched.
 * @param caseId - The case id.
 * @returns The locked message, or null when the reader may see the whole list.
 */
async function lockedFor(caseId: string) {
  const access = await readCaseAccess();

  return access === 'full' ? null : (
    <LockedList reason={access} caseHref={`/dashboard/cases/${caseId}`} />
  );
}

/**
 * Every alleged action of a case as a full table. The list's page and its popup both show it.
 * @param props - The body props.
 * @param props.caseId - The case id.
 * @returns The table.
 */
export async function ActionsBody(props: { caseId: string }) {
  const locked = await lockedFor(props.caseId);

  if (locked) {
    return locked;
  }

  const found = await caseOrNotFound(props.caseId);
  const actions = actionRows(await listActions(found.id), await listEvidence(found.id));

  return <ActionsTable actions={actions} />;
}

/**
 * All the evidence of a case as a full table, read-only.
 * @param props - The body props.
 * @param props.caseId - The case id.
 * @returns The table.
 */
export async function EvidenceBody(props: { caseId: string }) {
  const locked = await lockedFor(props.caseId);

  if (locked) {
    return locked;
  }

  const found = await caseOrNotFound(props.caseId);

  return <EvidenceTable items={await listEvidence(found.id)} />;
}

/**
 * Every suspected person and group of a case as a full table.
 * @param props - The body props.
 * @param props.caseId - The case id.
 * @returns The table.
 */
export async function OperatorsBody(props: { caseId: string }) {
  const locked = await lockedFor(props.caseId);

  if (locked) {
    return locked;
  }

  const found = await caseOrNotFound(props.caseId);

  return <OperatorsTable operators={found.operators} />;
}

/**
 * The statements of a case with where each one's research stands, as a full table. A statement has a page once its report is saved.
 * @param props - The body props.
 * @param props.caseId - The case id.
 * @returns The summary, the table and the note that a report declares no fraud.
 */
export async function ReportsBody(props: { caseId: string }) {
  const locked = await lockedFor(props.caseId);

  if (locked) {
    return locked;
  }

  const found = await caseOrNotFound(props.caseId);
  const t = await getTranslations('Analysis');
  const items = await listResearch(found.id);
  const rows = researchRows(items, (item) =>
    item.state === 'reported' && item.run !== null
      ? `/dashboard/cases/${found.id}/analysis/${item.run}`
      : null,
  );
  const reported = items.filter((item) => item.state === 'reported').length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <p className="max-w-prose text-ink-muted">
        {items.length === 0
          ? t('list_empty')
          : t('list_summary', { reported, total: items.length })}
      </p>
      {items.length > 0 && <ResearchTable rows={rows} />}
      <p className="text-sm text-ink-muted">{t('list_disclaimer')}</p>
    </div>
  );
}

/**
 * Every claim in a case as a full table. Claimants are shown to Celia staff and the firm that leads the case, never to anyone
 * else, so for anyone else this is "not found".
 * @param props - The body props.
 * @param props.caseId - The case id.
 * @returns The table.
 */
export async function ClaimantsBody(props: { caseId: string }) {
  const found = await caseOrNotFound(props.caseId);
  const t = await getTranslations('CaseDetail');
  const user = await currentUser();
  const staff = parseAccount(user?.publicMetadata)?.staff === true;

  if (!user || !(await canViewCaseClaims({ userId: user.id, staff }, found.id))) {
    notFound();
  }

  const claimants = await loadClaimantRows(found.id, (number) => t('claimant_number', { number }));

  return <CaseClaimantsTable claims={claimants} />;
}
