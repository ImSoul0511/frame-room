import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './errors.js';
import type { ApiEnv } from '../config/env.js';

export interface Identity {
  id: string;
  isVerified: boolean;
}
export type Authenticate = (authorization?: string) => Promise<Identity>;
export function authClient(env: ApiEnv): SupabaseClient | undefined {
  return env.SUPABASE_ANON_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : undefined;
}
export function createAuthenticator(env: ApiEnv): Authenticate {
  const client = authClient(env);
  return async (authorization) => {
    if (!authorization?.startsWith('Bearer '))
      throw new ApiError(401, 'UNAUTHORIZED', 'authentication_required');
    if (!client) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'auth_not_configured');
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !data.user) throw new ApiError(401, 'UNAUTHORIZED', 'invalid_session');
    return { id: data.user.id, isVerified: Boolean(data.user.email_confirmed_at) };
  };
}
