import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@frameroom/shared';
import { Navigate, useLocation } from 'react-router-dom';
import { api, RequestError, supabase } from './api';
import { useStrings } from '../lib/i18n';

type AuthState = {
  session: Session | null;
  profile: Profile | undefined;
  loading: boolean;
  profileLoading: boolean;
  profileError: Error | null;
};
const AuthContext = createContext<AuthState>({
  session: null,
  profile: undefined,
  loading: true,
  profileLoading: false,
  profileError: null,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const client = useQueryClient();
  const previousUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, current) => {
      if (previousUser.current !== current?.user.id) client.clear();
      previousUser.current = current?.user.id;
      setSession(current);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  const profile = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: ({ signal }) => api<Profile>('/v1/me', { signal }),
    enabled: Boolean(session),
    retry: false,
  });
  return (
    <AuthContext.Provider
      value={{
        session,
        profile: profile.data,
        loading,
        profileLoading: profile.isPending && Boolean(session),
        profileError: profile.error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function RequireAuth({ children }: { children: ReactNode }) {
  const strings = useStrings();

  const auth = useAuth();
  const location = useLocation();
  if (auth.loading || auth.profileLoading) return <p role="status">{strings.pending}</p>;
  if (!auth.session)
    return (
      <Navigate
        to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (auth.profileError instanceof RequestError && auth.profileError.reason === 'profile_required')
    return <Navigate to="/onboarding" replace />;
  if (auth.profileError) return <div role="alert">{auth.profileError.message}</div>;
  return children;
}
