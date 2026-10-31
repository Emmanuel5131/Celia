import { createHash } from 'node:crypto';
import type { Brief } from '@celia/core';
import { canonicalJson } from '@/utils/cases/Report';

/**
 * The commitment for a brief: SHA-256 of its canonical JSON, which includes the template and its version. Stored with its time
 * before a run starts, it shows the method was fixed before the data was read. The same brief always gives the same hash,
 * whatever order its keys were written in.
 * @param brief - The approved brief.
 * @returns The hash as `0x` and 64 hex characters.
 */
export function commitmentHash(brief: Brief) {
  return `0x${createHash('sha256').update(canonicalJson(brief)).digest('hex')}`;
}
