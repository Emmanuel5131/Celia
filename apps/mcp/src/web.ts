import type { Caller } from './auth.ts';

/**
 * Builds the way tools ask the Celia web app for data, as the person who is calling. The web app decides what they may see; this
 * server only passes the question on and the answer back.
 * @param webUrl - The Celia web app.
 * @param caller - Who is calling.
 * @returns A function that reads one path as JSON, or sends a body to it when it has one.
 */
export function createWebClient(webUrl: string, caller: Caller) {
  return async (path: string, send?: { body: unknown }): Promise<unknown> => {
    const response = await fetch(`${webUrl}${path}`, {
      method: send ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${caller.token}`,
        ...(send && { 'Content-Type': 'application/json' }),
      },
      body: send ? JSON.stringify(send.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404) {
      throw new Error('Not found');
    }

    // A refused report or call says what to fix, so the assistant can fix it or tell the staff member what to do (for example
    // 409: connect Sandworm; 503: Sandworm is not set up).
    if (response.status === 422 || response.status === 409 || response.status === 503) {
      throw new Error(`Celia refused it: ${JSON.stringify(await response.json())}`);
    }

    if (!response.ok) {
      throw new Error(`Celia could not answer (${response.status})`);
    }

    return await response.json();
  };
}

export type WebClient = ReturnType<typeof createWebClient>;
