import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { IBM_Plex_Mono, Mulish } from 'next/font/google';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { IconProvider } from '@/components/IconProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { routing } from '@/libs/I18nRouting';
import { AppConfig } from '@/utils/AppConfig';
import { getBaseUrl } from '@/utils/Helpers';
import '@/styles/global.css';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'App' });

  return {
    metadataBase: new URL(getBaseUrl()),
    applicationName: AppConfig.name,
    // Pages give a short title, and the site name is added after it.
    title: { default: t('meta_title'), template: `%s · ${AppConfig.name}` },
    description: t('meta_description'),
    // No og:title or og:description here: a page's own title and description are the fallback for link previews.
    openGraph: { type: 'website', siteName: AppConfig.name, locale },
    twitter: { card: 'summary' },
    icons: [
      {
        rel: 'apple-touch-icon',
        url: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        url: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/favicon-16x16.png',
      },
      {
        rel: 'icon',
        url: '/favicon.ico',
      },
    ],
  };
}

// Sets the light or dark class before the first paint. next-themes renders its own copy of this inside a client component,
// which React 19 warns about, so it is switched off below (`scriptProps`) and this server-rendered copy does the work.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'light';var d=document.documentElement;var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.classList.remove('light','dark');d.classList.add(r);d.style.colorScheme=r}catch(e){}})()`;

const mulish = Mulish({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mulish',
  display: 'swap',
});

// Evidence data only: hashes, addresses, ids and timestamps.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});

// Trial files: replace with the licensed Aeonik before launch (docs/DESIGN.md §12).
const aeonik = localFont({
  src: [
    { path: '../../assets/fonts/AeonikTRIAL-Regular.otf', weight: '400' },
    { path: '../../assets/fonts/AeonikTRIAL-Bold.otf', weight: '700' },
  ],
  variable: '--font-aeonik',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${mulish.variable} ${plexMono.variable} ${aeonik.variable}`}
    >
      {/* Browser extensions such as ColorZilla add attributes to the body before React loads; that is not an error in the page. */}
      <body
        suppressHydrationWarning
        className="bg-background font-sans text-foreground antialiased"
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          scriptProps={{ type: 'application/json' }}
        >
          <NextIntlClientProvider>
            <IconProvider>
              <TooltipProvider>{props.children}</TooltipProvider>
            </IconProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
