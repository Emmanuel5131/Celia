import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The env files in the repository are for defaults that anyone may read. A real key or password belongs in `.env.local` or the host's
// secret store, which git ignores. A placeholder is short; a real key is not, so a long value on a secret-looking name is refused.
const secretName = /^(?!NEXT_PUBLIC_).*(KEY|SECRET|TOKEN|PASSWORD)$/u;
const longest = 30;

const files = readdirSync('.').filter(
  (name) => name.startsWith('.env') && !name.endsWith('.local') && !name.endsWith('.example'),
);

const values = (file: string) =>
  readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const [name = '', ...rest] = line.split('=');

      return [
        name.trim(),
        rest
          .join('=')
          .trim()
          .replaceAll(/^["']|["']$/gu, ''),
      ] as const;
    });

describe('tracked env files', () => {
  it('finds the files it checks', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('keep keys, secrets and passwords out of %s', (file) => {
    const leaked = values(file)
      .filter(([name, value]) => secretName.test(name) && value.length > longest)
      .map(([name]) => name);

    expect(leaked).toStrictEqual([]);
  });
});
