import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seal, unseal } from './Seal';

const key = randomBytes(32).toString('base64');

describe(seal, () => {
  it('opens what it sealed', () => {
    expect(unseal(seal('refresh-token', key), key)).toBe('refresh-token');
  });

  it('seals the same text differently each time', () => {
    expect(seal('refresh-token', key)).not.toBe(seal('refresh-token', key));
  });

  it('hides the text', () => {
    expect(seal('refresh-token', key)).not.toContain('refresh-token');
  });
});

describe(unseal, () => {
  it('refuses another key', () => {
    expect(unseal(seal('refresh-token', key), randomBytes(32).toString('base64'))).toBeNull();
  });

  it('refuses text that was changed', () => {
    const [iv, tag, body] = seal('refresh-token', key).split('.');
    const changed = (body ?? '').replace(/^./u, (first) => (first === 'A' ? 'B' : 'A'));

    expect(unseal([iv, tag, changed].join('.'), key)).toBeNull();
  });

  it('refuses text that is not sealed', () => {
    expect(unseal('plain', key)).toBeNull();
    expect(unseal('', key)).toBeNull();
  });
});
