import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { OrganizationNote } from '@/components/auth/OrganizationNote';
import { getI18nPath } from '@/utils/Helpers';

type SignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: SignUpPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SignUp' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SignUpPage(props: SignUpPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const dashboardUrl = getI18nPath('/dashboard', locale);

  // Someone who is already signed in has nothing to do here, and Clerk would show an error instead of the form.
  const { userId } = await auth();

  if (userId) {
    redirect(dashboardUrl);
  }

  return (
    <>
      <SignUp path={getI18nPath('/sign-up', locale)} forceRedirectUrl={dashboardUrl} />
      <OrganizationNote />
    </>
  );
}
