import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';

/**
 * Seals text so it can sit in the database or a cookie: AES-256-GCM with a fresh nonce, so the same text never seals the same way
 * twice and any change to the sealed text is noticed when it is opened.
 * @param text - What to keep secret.
 * @param key - The 32-byte key in base64, checked when the environment is read.
 * @returns The nonce, the tag and the cipher text, joined by dots.
 */
export function seal(text: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, Buffer.from(key, 'base64'), iv);
  const body = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);

  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

/**
 * Opens text sealed by `seal`.
 * @param sealed - The sealed text.
 * @param key - The key it was sealed with.
 * @returns The text, or null when the key is wrong or the sealed text was changed.
 */
export function unseal(sealed: string, key: string) {
  const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));

  if (!iv || !tag || !body || iv.length !== 12 || tag.length !== 16) {
    return null;
  }

  try {
    const decipher = createDecipheriv(algorithm, Buffer.from(key, 'base64'), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}
