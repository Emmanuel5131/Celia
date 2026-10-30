import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentStaff } from '@/libs/accounts/Staff';
import { recordStaffAction, staffActor } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { saveConnection } from '@/libs/sandworm/Connection';
import { exchangeCode, PendingValidation, sandwormCookie } from '@/libs/sandworm/Sandworm';
import { getBaseUrl } from '@/utils/Helpers';
import { unseal } from '@/utils/Seal';

function finish(result: 'connected' | 'refused' | 'failed') {
  const response = NextResponse.redirect(
    new URL(`/dashboard/staff/sandworm?sandworm=${result}`, getBaseUrl()),
  );
  // A sign-in can be finished once.
  response.cookies.delete({ name: sandwormCookie, path: '/api/sandworm' });

  return response;
}

/**
 * Where Sandworm sends the staff member back after they sign in. The state and the person must match the sign-in Celia started,
 * the code is traded for tokens on the server, and the tokens are kept sealed. The staff page shows how it went.
 * @param request - The request, with `code` and `state`, or `error`, in the query.
 * @returns A redirect to the staff page with the result, or 404 for anyone who is not staff.
 */
export async function GET(request: NextRequest) {
  const staff = await currentStaff();

  if (!staff) {
    return new NextResponse('Not found', { status: 404 });
  }

  const query = request.nextUrl.searchParams;
  const sealed = request.cookies.get(sandwormCookie)?.value;
  const opened = sealed && Env.SANDWORM_TOKEN_KEY ? unseal(sealed, Env.SANDWORM_TOKEN_KEY) : null;
  const pending = PendingValidation.safeParse(JSON.parse(opened ?? 'null'));

  if (
    !pending.success ||
    pending.data.userId !== staff.id ||
    pending.data.state !== query.get('state')
  ) {
    return finish('failed');
  }

  if (query.get('error')) {
    return finish('refused');
  }

  const code = query.get('code');
  const tokens =
    code && Env.SANDWORM_CLIENT_ID
      ? await exchangeCode({
          code,
          verifier: pending.data.verifier,
          clientId: Env.SANDWORM_CLIENT_ID,
        })
      : null;

  if (!tokens) {
    return finish('failed');
  }

  await saveConnection(staff.id, tokens);
  await recordStaffAction(db, { actor: staffActor(staff), action: 'sandworm_connected' });

  return finish('connected');
}
