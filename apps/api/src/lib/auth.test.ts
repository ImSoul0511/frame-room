import { describe, expect, it } from 'vitest';

import { envSchema } from '../config/env.js';
import { authenticateVerified, createAuthenticator } from './auth.js';

describe('createAuthenticator', () => {
  const unconfigured = createAuthenticator(envSchema.parse({}));

  it('rejects a missing or non-bearer header', async () => {
    await expect(unconfigured(undefined)).rejects.toMatchObject({
      status: 401,
      reason: 'authentication_required',
    });
    await expect(unconfigured('Basic abc')).rejects.toMatchObject({ status: 401 });
  });

  it('reports 503 when Supabase Auth is not configured', async () => {
    await expect(unconfigured('Bearer token')).rejects.toMatchObject({
      status: 503,
      reason: 'auth_not_configured',
    });
  });
});

describe('authenticateVerified', () => {
  it('returns verified identities', async () => {
    const identity = await authenticateVerified(async () => ({ id: 'u1', isVerified: true }), 'x');
    expect(identity).toEqual({ id: 'u1', isVerified: true });
  });

  it('rejects unverified email with 403', async () => {
    await expect(
      authenticateVerified(async () => ({ id: 'u1', isVerified: false }), 'x'),
    ).rejects.toMatchObject({ status: 403, reason: 'email_confirmation_required' });
  });
});
