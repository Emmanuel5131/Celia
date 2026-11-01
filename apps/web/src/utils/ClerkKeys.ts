/**
 * Checks that a production deploy is not using Clerk's development instance. Development keys start with `pk_test_` and
 * `sk_test_`; the instance behind them lets anyone register a client and holds test users, so it must never serve real people.
 * @param options - The keys and where they are used.
 * @param options.deploy - The Vercel environment (`production`, `preview` or `development`), or undefined off Vercel.
 * @param options.publishableKey - The Clerk publishable key.
 * @param options.secretKey - The Clerk secret key.
 * @returns What is wrong, or null when the keys fit where they are used.
 */
export function clerkKeyProblem(options: {
  deploy: string | undefined;
  publishableKey: string;
  secretKey: string;
}) {
  if (options.deploy !== 'production') {
    return null;
  }

  const development =
    options.publishableKey.startsWith('pk_test_') || options.secretKey.startsWith('sk_test_');

  return development
    ? 'A production deploy is using Clerk development keys. Set the production instance keys (pk_live_ and sk_live_) in the host secrets.'
    : null;
}
