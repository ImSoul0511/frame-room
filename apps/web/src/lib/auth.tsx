import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@frameroom/shared';
import { Navigate, useLocation } from 'react-router-dom';
import { api, RequestError, supabase } from './api';
import { useStrings } from '../lib/i18n';
import { hotSingleton } from './hot-singleton';

type AuthState = {
  session: Session | null;
  profile: Profile | undefined;
  loading: boolean;
  profileLoading: boolean;
  profileError: Error | null;
  onboardingRequired: boolean;
  retryProfile: () => void;
};
const AuthContext = hotSingleton(import.meta.hot?.data, 'auth-context', () =>
  createContext<AuthState>({
    session: null,
    profile: undefined,
    loading: true,
    profileLoading: false,
    profileError: null,
    onboardingRequired: false,
    retryProfile: () => {},
  }),
);
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
        retryProfile: () => {
          void profile.refetch();
        },
        onboardingRequired:
          (profile.error instanceof RequestError && profile.error.reason === 'profile_required') ||
          Boolean(
            profile.data &&
            session?.user.user_metadata.registration_role === 'photographer' &&
            !profile.data.roles.includes('photographer'),
          ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: readonly string[];
}) {
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
  if (auth.onboardingRequired)
    return (
      <Navigate
        to={`/onboarding?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (auth.profileError)
    return (
      <div role="alert">
        <p>{auth.profileError.message}</p>
        <button type="button" className="button-link" onClick={auth.retryProfile}>
          {strings.retry}
        </button>
      </div>
    );
  if (roles && !roles.some((role) => auth.profile?.roles.includes(role)))
    return <p role="alert">{strings.errors.forbidden}</p>;
  return children;
}
