import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ApiEnv } from '../config/env.js';
import { ApiError, requireCondition } from './errors.js';

export interface Identity {
  id: string;
  isVerified: boolean;
}

/** Resolves an Authorization header into a verified identity or throws an ApiError. */
export type Authenticate = (authorization?: string) => Promise<Identity>;

const BEARER_PREFIX = 'Bearer ';

function createAuthClient(env: ApiEnv): SupabaseClient | undefined {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return undefined;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verifies the bearer token with Supabase Auth on every request. The actor id comes only
 * from the verified user, never from request bodies, headers or token metadata.
 */
export function createAuthenticator(env: ApiEnv): Authenticate {
  const client = createAuthClient(env);
  return async (authorization) => {
    if (!authorization?.startsWith(BEARER_PREFIX)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'authentication_required');
    }
    if (!client) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'auth_not_configured');
    const token = authorization.slice(BEARER_PREFIX.length).trim();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, 'UNAUTHORIZED', 'invalid_session');
    return { id: data.user.id, isVerified: Boolean(data.user.email_confirmed_at) };
  };
}

/** Authenticates and rejects accounts whose email is not confirmed. */
export async function authenticateVerified(
  authenticate: Authenticate,
  authorization?: string,
): Promise<Identity> {
  const identity = await authenticate(authorization);
  requireCondition(identity.isVerified, 403, 'email_confirmation_required');
  return identity;
}
