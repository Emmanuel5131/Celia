import { evidenceFileTypes, maxEvidenceFileBytes } from '@celia/core';
import * as z from 'zod';
import { Env } from '@/libs/Env';

const uploadsApi = 'https://uploads.pinata.cloud/v3/files';
const filesApi = 'https://api.pinata.cloud/v3/files/public';
const signedFor = 60;

const headers = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

const SignedResponse = z.object({ data: z.url() });

const FileResponse = z.object({
  data: z.object({
    id: z.string(),
    cid: z.string(),
    size: z.number(),
    mime_type: z.string(),
    name: z.string(),
  }),
});

/**
 * Asks Pinata for a one-minute address the browser uploads one file to, so the file goes from the browser to IPFS and never through
 * our server or database. The address only accepts the allowed file types, up to the largest size. Anything pinned is public.
 * @param fileName - The name of the file about to be uploaded.
 * @returns The upload address, `off` when Pinata is not set up, or `failed` when Pinata did not give one.
 */
export async function signUpload(fileName: string) {
  if (!Env.PINATA_JWT) {
    return 'off' as const;
  }

  const response = await fetch(`${uploadsApi}/sign`, {
    method: 'POST',
    headers: { ...headers(Env.PINATA_JWT), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: Math.floor(Date.now() / 1000),
      expires: signedFor,
      network: 'public',
      filename: fileName,
      max_file_size: maxEvidenceFileBytes,
      allow_mime_types: Object.keys(evidenceFileTypes),
    }),
  });
  const parsed = SignedResponse.safeParse(response.ok ? await response.json() : null);

  return parsed.success ? parsed.data.data : ('failed' as const);
}

/**
 * Reads what Pinata holds for a file, so the CID, size and type we keep come from Pinata and not from the browser.
 * @param id - Pinata's id for the file, as the upload returned it.
 * @returns The file's CID, name, size and media type, or null when Pinata has no such file.
 */
export async function getPinnedFile(id: string) {
  if (!Env.PINATA_JWT) {
    return null;
  }

  const response = await fetch(`${filesApi}/${encodeURIComponent(id)}`, {
    headers: headers(Env.PINATA_JWT),
  });
  const parsed = FileResponse.safeParse(response.ok ? await response.json() : null);

  return parsed.success
    ? {
        cid: parsed.data.data.cid,
        name: parsed.data.data.name,
        size: parsed.data.data.size,
        mimeType: parsed.data.data.mime_type,
      }
    : null;
}

/**
 * Stops pinning a file, for evidence staff removed. Other nodes may keep their copies.
 * @param id - Pinata's id for the file.
 */
export async function unpinFile(id: string) {
  if (!Env.PINATA_JWT) {
    return;
  }

  await fetch(`${filesApi}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(Env.PINATA_JWT),
  });
}

/**
 * The address a pinned file is read from.
 * @param cid - The file's CID.
 * @returns A gateway link.
 */
export function gatewayUrl(cid: string) {
  return `https://${Env.PINATA_GATEWAY ?? 'gateway.pinata.cloud'}/ipfs/${cid}`;
}
