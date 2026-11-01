import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // The shadcn components and layout primitives are a library: every part exists before a screen uses it. The scripts are run by hand
  // (docs/integrators/test-run.md), so nothing imports them.
  entry: [
    'src/components/ui/**/*.tsx',
    'src/components/layout/**/*.tsx',
    'scripts/seed/forsage-case.ts',
    'scripts/seed/clear.ts',
    'scripts/seed/case-details.ts',
    'scripts/seed/real-cases.ts',
    'scripts/check-findings.ts',
    'scripts/backfill-applications.ts',
  ],
  // Files to exclude from Knip analysis
  ignore: ['src/libs/I18n.ts', 'src/types/I18n.ts'],
  // Dependencies to ignore during analysis
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['tests/**/*.@(integ|e2e).ts'],
  },
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/gu)].join('\n'),
  },
  treatConfigHintsAsErrors: true,
};

export default config;
