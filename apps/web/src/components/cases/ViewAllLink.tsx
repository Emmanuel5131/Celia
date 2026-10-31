import { getTranslations } from 'next-intl/server';
import { LockedViewAll } from '@/components/cases/CaseLocked';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import type { CaseAccess } from '@/utils/accounts/CaseAccess';

/**
 * The button that opens the page listing every row, shown beside a short preview of a list.
 * @param props - The link props.
 * @param props.href - The page with the full list.
 * @param props.count - How many rows the full list holds.
 * @param props.access - How much of the case the reader may see; anything but `full` shows a locked button instead of the link.
 * @returns The button.
 */
export async function ViewAllLink(props: { href: string; count: number; access: CaseAccess }) {
  const t = await getTranslations('CaseDetail');

  if (props.access !== 'full') {
    return <LockedViewAll reason={props.access} count={props.count} />;
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={props.href}>{t('view_all', { count: props.count })}</Link>
    </Button>
  );
}
