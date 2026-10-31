import type { MetadataRoute } from 'next';

/**
 * The app has no public pages worth listing: the marketing site is its own project, and the first page here is a sign in. So there
 * is no sitemap, and the signed-in area and the API stay out of search results in every language.
 * @returns The rules.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/*/dashboard', '/api/'],
    },
  };
}
