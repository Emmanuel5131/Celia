import './src/libs/Env';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  // The jurisdictions package ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ['@celia/core', '@celia/jurisdictions'],
  reactStrictMode: true,
  reactCompiler: process.env.NODE_ENV === 'production', // Keep the development environment fast
  experimental: {
    agentUpgrade: 'security',
    // Three proof files of up to 4 MB each, with room for the form around them. Every other action sends far less.
    serverActions: { bodySizeLimit: '13mb' },
    // The dev cache on disk (`.next/dev/cache`, 1 GB) is off on purpose: on a fresh start the dev server sometimes recompiled about
    // once a second with no file changing, and every pass reloaded the page, until `.next` was deleted. Starting without the saved
    // state costs a slower first compile. If a month of fresh starts never loops, the cache was the cause; if it still loops, put
    // this back and look at Clerk (the sign-in route's catch-all check takes 9 to 17 s when Clerk answers slowly).
    turbopackFileSystemCacheForDev: false,
    // `turbopackGc` is off on purpose: in Next 16.4 it collects tasks the HMR state still references, and the dev server
    // dies with "task is missing in memory or persistent storage". Turn it back on after upgrading Next.
    // Use the Rust version, instead of the OG Babel one
    turbopackRustReactCompiler: process.env.NODE_ENV === 'production',
  },
  logging: {
    browserToTerminal: process.env.BROWSER_TO_TERMINAL_DISABLED !== 'true',
  },
  outputFileTracingIncludes: {
    '/': ['./migrations/**/*'],
  },
  // Next expects `headers` to return a promise; there is nothing to await.
  // oxlint-disable-next-line require-await
  async headers() {
    return [
      {
        // The staff area shows people's claims: never cached, never put in a frame, never indexed.
        source: '/(.*)dashboard/staff(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

// Initialize the Next-Intl plugin
let configWithPlugins = createNextIntlPlugin('./src/libs/I18n.ts')(baseConfig);

// Conditionally enable Sentry configuration
if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options
    org: process.env.SENTRY_ORGANIZATION,
    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    webpack: {
      reactComponentAnnotation: {
        enabled: true,
      },

      // Tree-shake Sentry logger statements to reduce bundle size
      treeshake: {
        removeDebugLogging: true,
      },
    },

    // Disable Sentry telemetry
    telemetry: false,
  });
}

const nextConfig = configWithPlugins;
export default nextConfig;
