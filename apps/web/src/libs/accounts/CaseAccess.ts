import { currentUser } from '@clerk/nextjs/server';
import { staffDecision } from '@/libs/accounts/Staff';
import { parseAccount } from '@/utils/accounts/Account';
import { caseAccess } from '@/utils/accounts/CaseAccess';

/**
 * Reads how much of a case the signed-in person may read. Call it before reading any list of a case, and cut the list to the
 * preview when the access is not `full`.
 * @returns The access.
 */
export async function readCaseAccess() {
  const user = await currentUser();

  return caseAccess({
    account: parseAccount(user?.publicMetadata),
    staff: user ? staffDecision(user) === 'allowed' : false,
  });
}
