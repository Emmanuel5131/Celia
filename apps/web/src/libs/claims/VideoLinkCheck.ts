import type { VideoCheck } from '@/utils/claims/ClaimEvidence';

async function askVideoLink(url: string): Promise<VideoCheck> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; CeliaLinkCheck)' },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);

  if (!response) {
    return 'unknown';
  }

  if (response.status === 404 || response.status === 410) {
    return 'gone';
  }

  return response.ok ? 'ok' : 'unknown';
}

// A link is asked about once: a settled answer is kept for an hour.
const settled = new Map<string, { answer: VideoCheck; until: number }>();

/**
 * Asks whether a video link still opens. Only a page that is not found or is gone counts as gone; a site that is slow, blocks
 * scripts or errors gives `unknown`, so a failed check is never held against a person.
 * @param url - The link a person gave.
 * @returns `ok`, `gone` or `unknown`.
 */
export async function checkVideoLink(url: string): Promise<VideoCheck> {
  const known = settled.get(url);

  if (known && known.until > Date.now()) {
    return known.answer;
  }

  const answer = await askVideoLink(url);

  if (answer !== 'unknown') {
    settled.set(url, { answer, until: Date.now() + 60 * 60 * 1000 });
  }

  return answer;
}
