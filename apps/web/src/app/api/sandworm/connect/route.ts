import { NextResponse } from 'next/server';
import { currentStaff } from '@/libs/accounts/Staff';
import { Env } from '@/libs/Env';
import { sandwormSetUp } from '@/libs/sandworm/Connection';
import { discoverSandworm, sandwormCookie, sandwormRedirectUri } from '@/libs/sandworm/Sandworm';
import { getBaseUrl } from '@/utils/Helpers';
import { authorizeUrl, createPkce } from '@/utils/sandworm/Pkce';
import { seal } from '@/utils/Seal';

/**
 * Sends the signed-in staff member to Sandworm to sign in and approve Celia. The PKCE verifier and state wait in a sealed cookie
 * that only the callback can open, so the sign-in cannot be finished by anyone else. Only staff may start it.
 * @returns A redirect to Sandworm, back to the staff page when Sandworm is not set up, or 404.
 */
export async function GET() {
  const staff = await currentStaff();

  if (!staff) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (!sandwormSetUp() || !Env.SANDWORM_CLIENT_ID || !Env.SANDWORM_TOKEN_KEY) {
    return NextResponse.redirect(new URL('/dashboard/staff/sandworm', getBaseUrl()));
  }

  const { verifier, challenge, state } = createPkce();
  const { resource, authorizationEndpoint } = await discoverSandworm();

  const response = NextResponse.redirect(
    authorizeUrl({
      endpoint: authorizationEndpoint,
      clientId: Env.SANDWORM_CLIENT_ID,
      redirectUri: sandwormRedirectUri(),
      resource,
      challenge,
      state,
    }),
  );

  response.cookies.set(
    sandwormCookie,
    seal(JSON.stringify({ state, verifier, userId: staff.id }), Env.SANDWORM_TOKEN_KEY),
    {
      httpOnly: true,
      secure: Env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/sandworm',
      maxAge: 600,
    },
  );

  return response;
}
