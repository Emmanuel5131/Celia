'use server';

import type { TakeCaseRefusal } from '@celia/core';
import { currentUser } from '@clerk/nextjs/server';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as z from 'zod';
import { evaluateTake, getCase, takeCase } from '@/libs/cases/Cases';
import { getOrStartDraft, saveStep, submitRequest } from '@/libs/contact/ContactRequests';
import { saveLocale } from '@/libs/notifications/UserSettings';
import { parseAccount } from '@/utils/accounts/Account';
import { parseProfile } from '@/utils/accounts/Profile';
import { getI18nPath } from '@/utils/Helpers';

export type TakeCaseState = {
  /** Why the case could not be taken, or null when it was. */
  reason: TakeCaseRefusal | null;
};

/**
 * Takes a case for the signed-in lawyer's firm. The server decides: it re-reads the lawyer's review status and open cases itself and trusts nothing in the form except the lawyer's confirmation that their firm checked conflicts.
 * @param caseId - The case id.
 * @param formData - The submitted form, with the `conflicts` confirmation.
 * @returns The reason the case could not be taken, or null.
 */
export async function takeCaseAction(caseId: string, formData: FormData): Promise<TakeCaseState> {
  const user = await currentUser();
  const account = parseAccount(user?.publicMetadata);

  if (!user || account?.accountType !== 'counsel') {
    return redirect(getI18nPath('/dashboard', await getLocale()));
  }

  const found = z.uuid().safeParse(caseId).success ? await getCase(caseId) : undefined;
  const profile = parseProfile('counsel', user.privateMetadata);

  if (!found || profile?.accountType !== 'counsel') {
    return { reason: 'not_verified' };
  }

  await saveLocale(user.id, await getLocale());
  const decision = await evaluateTake({
    userId: user.id,
    verified: account.review === 'verified',
    found,
    conflictsConfirmed: formData.get('conflicts') === 'on',
  });

  if (!decision.ok) {
    return { reason: decision.reason };
  }

  if (!(await takeCase({ caseId, userId: user.id }))) {
    return { reason: 'already_taken' };
  }

  revalidatePath('/', 'layout');

  return { reason: null };
}

export type ContactRequestState = {
  /** What stopped the request, or null when it was sent for review. */
  problem: 'invalid' | 'not_verified' | 'state' | null;
  /** The names of the rules the form broke, such as `promise_words`; empty unless `problem` is `invalid`. */
  issues: string[];
};

/**
 * Sends a verified organisation's request to reach the claimants of a case. It saves the four steps of the form and sends the
 * request for review in one go; each step is checked again on the server, and nobody is asked until staff approve it.
 * @param caseId - The case id.
 * @param formData - The submitted form: `purpose`, `purposeOther` (when the purpose is other), `askerRole`, `reason`, `message` and every ticked `declarations`.
 * @returns What stopped the request, or null problem when it was sent.
 */
export async function sendContactRequestAction(
  caseId: string,
  formData: FormData,
): Promise<ContactRequestState> {
  const user = await currentUser();
  const account = parseAccount(user?.publicMetadata);

  if (!user || account?.accountType !== 'counsel') {
    return redirect(getI18nPath('/dashboard', await getLocale()));
  }

  const found = z.uuid().safeParse(caseId).success ? await getCase(caseId) : undefined;

  if (!found || account.review !== 'verified') {
    return { problem: 'not_verified', issues: [] };
  }

  const ownWords = formData.get('purposeOther');
  const requesterId = user.id;
  const draft = await getOrStartDraft({ caseId, requesterId });
  const requestId = draft?.id ?? '';
  const saved = await Promise.all([
    saveStep({
      requestId,
      requesterId,
      step: 'who',
      input: {
        purpose: formData.get('purpose'),
        purposeOther: ownWords === '' ? undefined : ownWords,
        askerRole: formData.get('askerRole'),
      },
    }),
    saveStep({ requestId, requesterId, step: 'why', input: { reason: formData.get('reason') } }),
    saveStep({
      requestId,
      requesterId,
      step: 'rules',
      input: { declarations: formData.getAll('declarations') },
    }),
    saveStep({
      requestId,
      requesterId,
      step: 'message',
      input: { message: formData.get('message') },
    }),
  ]);

  if (saved.some((step) => step.problem === 'state')) {
    return { problem: 'state', issues: [] };
  }

  const issues = saved.flatMap((step) => (step.problem === 'invalid' ? step.issues : []));

  if (issues.length > 0) {
    return { problem: 'invalid', issues };
  }

  return (await submitRequest({ requestId, requesterId })) === 'ok'
    ? { problem: null, issues: [] }
    : { problem: 'state', issues: [] };
}
