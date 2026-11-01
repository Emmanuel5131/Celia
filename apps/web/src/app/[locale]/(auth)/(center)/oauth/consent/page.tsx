import { OAuthConsent } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getI18nPath } from '@/utils/Helpers';

type OAuthConsentPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Where a person approves an assistant, such as Claude, that wants to act for them through the MCP server. Clerk sends them here
 * from its sign-in server and finishes the sign-in once they answer. Without this page, Clerk will not let assistants sign themselves up.
 * @param props - The page props, with the locale and the query Clerk sent.
 * @returns Clerk's approval screen, or a redirect to sign in first.
 */
export default async function OAuthConsentPage(props: OAuthConsentPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const { userId } = await auth();

  if (!userId) {
    // Sign in on our own page, then come back with everything the assistant asked for. Clerk's own sign-in redirect would send them
    // to its hosted pages, which this domain does not have.
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(await props.searchParams)) {
      for (const item of [value ?? []].flat()) {
        query.append(key, item);
      }
    }

    const consentUrl = `${getI18nPath('/oauth/consent', locale)}?${query}`;

    return redirect(
      `${getI18nPath('/sign-in', locale)}?redirect_url=${encodeURIComponent(consentUrl)}`,
    );
  }

  return <OAuthConsent />;
}
