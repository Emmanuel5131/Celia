import { getTranslations } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';

/**
 * A line under the sign-in and sign-up forms: those are for people reporting a loss, and organizations have their own page.
 * @returns The note with a link to the organization page.
 */
export async function OrganizationNote() {
  const t = await getTranslations('AuthShell');

  return (
    <p className="text-sm text-ink-muted">
      {t('organization_prompt')}{' '}
      <Link href="/join" className="font-medium text-ink underline underline-offset-4">
        {t('organization_link')}
      </Link>
    </p>
  );
}
