'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsClient } from '@/hooks/use-is-client';

/**
 * Picks light, dark or the system setting. The choice is saved by next-themes in the browser.
 * @returns The theme select.
 */
export function ThemeSelect() {
  const t = useTranslations('Settings');
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  return (
    <Select value={isClient ? (theme ?? 'light') : 'light'} onValueChange={setTheme}>
      <SelectTrigger size="sm" className="w-36" aria-label={t('theme_title')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">{t('theme_system')}</SelectItem>
        <SelectItem value="light">{t('theme_light')}</SelectItem>
        <SelectItem value="dark">{t('theme_dark')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
