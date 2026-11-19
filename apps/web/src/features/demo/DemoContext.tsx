import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { hotSingleton } from '../../lib/hot-singleton';
import type { CardProvider } from '../catalog/ProviderCard';
import type { DemoAction, DemoFile, DemoOffer, DemoRole, DemoState } from './types';
import { createDemoState } from './seed';
import { applyDemoAction, DemoError, validateDemoFile } from './model';

type DemoContextValue = {
  state: DemoState;
  role: DemoRole;
  choice: DemoRole | 'account';
  loading: boolean;
  setRole: (role: DemoRole | 'account') => void;
  reset: () => void;
  dispatch: (action: DemoAction) => void;
  text: (value: string) => string;
  file: (file: File) => DemoFile;
  image: (url: string, index?: number) => string;
  offer: DemoOffer | null;
  setOffer: (offer: DemoOffer | null) => void;
};
const DemoContext = hotSingleton(import.meta.hot?.data, 'demo-context', () =>
  createContext<DemoContextValue | null>(null),
);
export function DemoProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const t = useStrings();
  const [choice, setRole] = useState<DemoRole | 'account'>('account');
  const [state, setState] = useState(createDemoState);
  const [offer, setOffer] = useState<DemoOffer | null>(null);
  const current = useRef(state);
  const uploads = useRef<string[]>([]);
  const roles = auth.profile?.roles ?? [];
  const accountRole: DemoRole = roles.includes('system_admin')
    ? 'admin'
    : roles.includes('studio_manager')
      ? 'manager'
      : roles.includes('photographer')
        ? 'photographer'
        : auth.profile
          ? 'client'
          : 'guest';
  const role = choice === 'account' ? accountRole : choice;
  const media = useQuery({
    queryKey: ['demo-public-covers'],
    queryFn: ({ signal }) => api<CardProvider[]>('/v1/explore?pageSize=50', { signal }),
    enabled: role !== 'guest',
    retry: false,
    staleTime: Infinity,
  });
  useEffect(() => () => uploads.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const text = (value: string) => t.demo[value as keyof typeof t.demo] ?? value;
  return (
    <DemoContext.Provider
      value={{
        state,
        role,
        choice,
        offer,
        setOffer,
        loading: choice === 'account' && (auth.loading || auth.profileLoading),
        setRole,
        text,
        dispatch(action) {
          const next = applyDemoAction(current.current, role, action);
          current.current = next;
          setState(next);
        },
        reset() {
          uploads.current.forEach((url) => URL.revokeObjectURL(url));
          uploads.current = [];
          setOffer(null);
          const next = createDemoState();
          current.current = next;
          setState(next);
        },
        file(source) {
          const value = {
            id: crypto.randomUUID(),
            name: source.name,
            mime: source.type,
            size: source.size,
            url: '',
          };
          validateDemoFile(value);
          value.url = URL.createObjectURL(source);
          uploads.current.push(value.url);
          return value;
        },
        image(url, index = 0) {
          const covers = (media.data ?? []).filter((provider) => provider.coverUrl);
          return url.startsWith('data:image/svg+xml') && covers.length
            ? covers[index % covers.length].coverUrl!
            : url;
        },
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider is required');
  return value;
}
export function useDemoTask() {
  const demo = useDemo();
  const t = useStrings();
  const [error, setError] = useState<Error | null>(null);
  const attempt = (work: () => void) => {
    try {
      work();
      setError(null);
      return true;
    } catch (caught) {
      setError(
        new Error(
          caught instanceof DemoError
            ? (t.demoErrors[caught.reason as keyof typeof t.demoErrors] ?? t.errors.generic)
            : t.errors.generic,
        ),
      );
      return false;
    }
  };
  return {
    error,
    clear: () => setError(null),
    attempt,
    execute: (action: DemoAction) => attempt(() => demo.dispatch(action)),
  };
}
export function DemoGate({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: readonly DemoRole[];
}) {
  const demo = useDemo();
  const t = useStrings();
  if (demo.loading) return <p role="status">{t.pending}</p>;
  if (demo.role === 'guest' || (roles && !roles.includes(demo.role)))
    return (
      <section className="workspace-empty">
        <h1>{t.demo.forbidden}</h1>
        <p>{t.demo.chooseRole}</p>
        <Link className="button-link" to="/explore">
          {t.nav.explore}
        </Link>
      </section>
    );
  return children;
}
