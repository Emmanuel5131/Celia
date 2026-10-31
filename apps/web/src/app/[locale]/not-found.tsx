import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NotFound');

  return { title: t('title') };
}

/**
 * The page for an address that does not exist. It is also what someone sees for a page they may not open, such as the staff area,
 * so it says nothing about why.
 * @returns The page.
 */
export default async function NotFoundPage() {
  const t = await getTranslations('NotFound');

  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center justify-items-start gap-6 px-4 py-16">
      <p className="text-sm text-ink-muted">{t('code')}</p>
      <h1 className="text-3xl">{t('title')}</h1>
      <p className="text-ink-muted">{t('text')}</p>
      <Button asChild>
        <Link href="/dashboard">{t('action')}</Link>
      </Button>
    </main>
  );
}
