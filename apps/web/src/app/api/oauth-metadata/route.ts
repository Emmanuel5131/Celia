/**
 * Serves Clerk's OAuth server description at the address a client looks for first.
 *
 * Clerk is reached through our `/__clerk` path on shared hosts, so its sign-in server is `<app>/__clerk`. A client reads such a
 * server at `/.well-known/oauth-authorization-server/__clerk` (see `next.config.ts`). Clerk only answers under its own path, and
 * the fallback document it gives there leaves out the registration address, so assistants cannot sign themselves up.
 * @param request - The incoming request.
 * @returns Clerk's description, which names the registration address.
 */
export async function GET(request: Request) {
  const source = new URL('/__clerk/.well-known/oauth-authorization-server', request.url);
  const response = await fetch(source);

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
