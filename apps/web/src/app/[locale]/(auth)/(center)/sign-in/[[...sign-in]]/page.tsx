import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrganizationNote } from '@/components/auth/OrganizationNote';
import { getI18nPath } from '@/utils/Helpers';

type SignInPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export async function generateMetadata(props: SignInPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SignIn' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SignInPage(props: SignInPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  // An assistant that is signing in sends the person here from Clerk's sign-in server (an address) or from our consent page (a path), and
  // they must go back to that step, not to the dashboard. Only those two places on this host are followed, so this cannot send anyone
  // to another site.
  const { redirect_url: returnTo } = await props.searchParams;
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const back = typeof returnTo === 'string' ? new URL(returnTo, `https://${host}`) : null;
  const isAssistantStep =
    back?.host === host &&
    (back.pathname === getI18nPath('/oauth/consent', locale) ||
      back.pathname.startsWith('/__clerk/oauth/'));
  const dashboardUrl = isAssistantStep
    ? `${back.pathname}${back.search}`
    : getI18nPath('/dashboard', locale);

  // Someone who is already signed in has nothing to do here, and Clerk would show an error instead of the form.
  const { userId } = await auth();

  if (userId) {
    redirect(dashboardUrl);
  }

  return (
    <>
      <SignIn path={getI18nPath('/sign-in', locale)} forceRedirectUrl={dashboardUrl} />
      <OrganizationNote />
    </>
  );
}
