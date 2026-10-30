import { enUS, frFR } from '@clerk/localizations';
import type { LocalizationResource } from '@clerk/shared/types';
import type { LocalePrefixMode } from 'next-intl/routing';

/** Locale prefix strategy for next-intl routing. */
const localePrefix: LocalePrefixMode = 'as-needed';

/** Centralized application configuration */
export const AppConfig = {
  name: 'Celia',
  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    localePrefix,
  },
};

// The buttons read "Google" and "Microsoft" side by side (Clerk's own text when several are shown), and "Continue with Google" when
// there is only one. The divider above them says what they are for.
const supportedLocales: Record<string, LocalizationResource> = {
  en: {
    ...enUS,
    socialButtonsBlockButton: 'Continue with {{provider|titleize}}',
    dividerText: 'Or continue with',
  },
  fr: {
    ...frFR,
    socialButtonsBlockButton: 'Continuer avec {{provider|titleize}}',
    dividerText: 'Ou continuer avec',
  },
};

export const ClerkLocalizations = {
  defaultLocale: enUS,
  supportedLocales,
};
