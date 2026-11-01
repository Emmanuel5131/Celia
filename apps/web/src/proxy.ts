import { detectBot } from '@arcjet/next';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createMiddleware from 'next-intl/middleware';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import arcjet from '@/libs/Arcjet';
import { routing } from './libs/I18nRouting';

const handleI18nRouting = createMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/:locale/dashboard(.*)',
  '/onboarding(.*)',
  '/:locale/onboarding(.*)',
]);

// Where a session that still has to choose an organization finishes signing in. Clerk keeps that session "pending" until the choice is
// made, and treats a pending session as signed out, so this one page has to let it through or nobody could ever make the choice.
const isOrganizationStep = createRouteMatcher([
  '/onboarding/organization(.*)',
  '/:locale/onboarding/organization(.*)',
]);

// Clerk's `auth()` only works in a request that went through its middleware. These routes check who is asking themselves and
// give a stranger a 404, so the middleware runs on them to identify the person but does not protect or translate them.
const isClaimsApi = createRouteMatcher(['/api/claims(.*)', '/api/sandworm(.*)']);
// The MCP routes are called by the MCP server with an assistant's OAuth token, not by a browser, so Clerk runs on them to read the token
// and the bot check is skipped: the token is the check.
const isMcpApi = createRouteMatcher(['/api/mcp(.*)']);
// With a production Clerk key on a shared host such as `*.vercel.app`, Clerk loads its scripts and talks to its API through this path on
// our own domain. Only Clerk's middleware can answer it, so it must run here before i18n routing turns the path into a 404.
const isClerkProxy = createRouteMatcher(['/__clerk(.*)']);

const isAuthPage = createRouteMatcher([
  '/sign-in(.*)',
  '/:locale/sign-in(.*)',
  '/staff/sign-in(.*)',
  '/:locale/staff/sign-in(.*)',
  '/oauth/consent(.*)',
  '/:locale/oauth/consent(.*)',
  '/sign-up(.*)',
  '/:locale/sign-up(.*)',
]);

// Improve security with Arcjet
const aj = arcjet.withRule(
  detectBot({
    mode: 'LIVE',
    // Block all bots except the following
    allow: [
      // See https://docs.arcjet.com/bot-protection/identifying-bots
      'CATEGORY:SEARCH_ENGINE', // Allow search engines
      'CATEGORY:PREVIEW', // Allow preview links to show OG images
      'CATEGORY:MONITOR', // Allow uptime monitoring services
    ],
  }),
);

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isClerkProxy(request)) {
    // oxlint-disable-next-line typescript/return-await
    return clerkMiddleware()(request, event);
  }

  if (isMcpApi(request)) {
    // oxlint-disable-next-line typescript/return-await
    return clerkMiddleware()(request, event);
  }

  // Verify the request with Arcjet
  // Use `process.env` instead of Env to reduce bundle size in middleware
  if (process.env.ARCJET_KEY) {
    const decision = await aj.protect(request);

    if (decision.isDenied()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (isClaimsApi(request)) {
    // oxlint-disable-next-line typescript/return-await
    return clerkMiddleware()(request, event);
  }

  // Clerk keyless mode doesn't work with i18n, this is why we need to run the middleware conditionally
  if (isAuthPage(request) || isProtectedRoute(request)) {
    // Match Clerk's documented middleware composition pattern, `return await` is not necessary.
    // oxlint-disable-next-line typescript/return-await
    return clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        const locale =
          req.nextUrl.pathname.match(/^(\/.+?)\/(?:dashboard|onboarding)/u)?.at(1) ?? '';

        const signInUrl = new URL(`${locale}/sign-in`, req.url);

        if (isOrganizationStep(req)) {
          const { userId } = await auth({ treatPendingAsSignedOut: false });

          if (!userId) {
            return NextResponse.redirect(signInUrl);
          }
        } else {
          await auth.protect({
            unauthenticatedUrl: signInUrl.toString(),
          });
        }
      }

      return handleI18nRouting(req);
    })(request, event);
  }

  return handleI18nRouting(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel`, `monitoring` or `api`, except `/api/claims`, `/api/mcp` and `/api/sandworm`, which need Clerk's middleware
  // - … the ones containing a dot (e.g. `favicon.ico`)
  // `/__clerk` is always matched, because Clerk's scripts under it contain dots.
  matcher: [
    '/((?!_next|_vercel|monitoring|api(?!/claims|/mcp|/sandworm)|.*\\..*).*)',
    '/__clerk/:path*',
  ],
};
