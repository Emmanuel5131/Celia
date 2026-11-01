import { describe, expect, it } from 'vitest';
import { clerkKeyProblem } from './ClerkKeys';

const test = { publishableKey: 'pk_test_x', secretKey: 'sk_test_x' };
const live = { publishableKey: 'pk_live_x', secretKey: 'sk_live_x' };

describe(clerkKeyProblem, () => {
  it('flags development keys on a production deploy', () => {
    expect(clerkKeyProblem({ deploy: 'production', ...test })).toContain('development keys');
    expect(
      clerkKeyProblem({
        deploy: 'production',
        publishableKey: 'pk_live_x',
        secretKey: 'sk_test_x',
      }),
    ).not.toBeNull();
  });

  it('allows development keys on a preview and on a machine', () => {
    expect(clerkKeyProblem({ deploy: 'preview', ...test })).toBeNull();
    expect(clerkKeyProblem({ deploy: undefined, ...test })).toBeNull();
  });

  it('allows production keys on a production deploy', () => {
    expect(clerkKeyProblem({ deploy: 'production', ...live })).toBeNull();
  });
});
