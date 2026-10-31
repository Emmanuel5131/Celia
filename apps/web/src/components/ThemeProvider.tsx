'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * next-themes with its script switched to a data block in the browser. On the server the script runs before the first paint and sets
 * the light or dark class; in the browser, where React would otherwise warn that a script was rendered inside a component, it is
 * `application/json`, which React treats as data and the browser never runs. The check has to sit in a client component: in the
 * layout it would be decided once, on the server.
 * @param props - The next-themes provider props.
 * @returns The provider.
 */
export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{ type: typeof window === 'undefined' ? undefined : 'application/json' }}
    />
  );
}
