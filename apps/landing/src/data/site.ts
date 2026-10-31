import { appJoin, appLogin } from './app';
/**
 * Single source of truth for brand facts.
 * Used by the UI, JSON-LD structured data, llms.txt and robots.txt so every
 * surface (search engines, AI assistants, humans) sees the same entity facts.
 *
 * The product name lives in `name` only. Change it here and the header, footer wordmark, loader and SEO follow.
 */
export const site = {
  name: 'Celia',
  alternateNames: [] as string[],
  url: 'https://example.com',
  locale: 'en_NG',
  language: 'en',
  tagline: 'Celia is a case bank for crypto fraud.',
  description:
    'Celia is an onchain case bank for law firms and investigative agencies. Victims of the same scheme add their wallet and a few lines of text, Celia is the case bank: it holds the wallets of those defrauded and the evidence from the chain, so nobody has to build the list of those affected. The law firm runs the case. Celia holds no funds and does not declare fraud.',
  shortDescription: 'Onchain case bank for law firms and investigative agencies: the wallets of those defrauded and the evidence, ready for counsel.',
  email: 'hello@example.com',
  areaServed: 'Worldwide',
  /** Small trust line shown in the footer. */
  proof: {
    note: 'We don’t declare fraud. We build every file to hold up in court.',
    link: { label: 'Find the evidence rule for your jurisdiction', href: '/jurisdictions/' },
  },
  infrastructure: { label: 'Data infrastructure by', name: 'Sandworm Labs' },
  socials: [] as { name: keyof typeof import('../lib/graphics/icons').socialIcons; href: string }[],
  knowsAbout: [
    'Onchain analytics', 'Falsity and loss', 'Reliance evidence', 'Digital asset disclosure', 'Evidence certificates', 'Computer-generated evidence',
    'Wash trading analysis', 'Funding-trail analysis', 'Legal technology', 'Regulatory technology',
  ],
} as const;

export type NavItem = { label: string; href: string };

export const nav: { links: NavItem[]; cta: NavItem } = {
  links: [
    { label: 'How it works', href: '/#process' },
    { label: 'Who can join', href: '/#join' },
    { label: 'Jurisdictions', href: '/jurisdictions/' },
    { label: 'MCP', href: '/mcp/' },
    { label: 'Pricing', href: '/pricing/' },
    { label: 'FAQ', href: '/#faq' },
  ],
  cta: { label: 'Report fraud', href: appLogin },
};

export const footerNav = {
  menu: [
    { label: 'Home', href: '/' },
    { label: 'Method', href: '/#method' },
    { label: 'Who can join', href: '/#join' },
    { label: 'MCP', href: '/mcp/' },
    { label: 'Pricing', href: '/pricing/' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Privacy', href: '/privacy/' },
    { label: 'Terms', href: '/terms/' },
  ],
  jurisdictions: [
    { label: 'United States · FRE 902(13)/(14)', href: '/jurisdictions/' },
    { label: 'Next jurisdiction', href: '/#report' },
  ],
  contact: [
    { label: 'Report fraud', href: appLogin },
    { label: 'Get professional access', href: appJoin },
    { label: 'Email us', href: `mailto:${site.email}` },
  ],
};
