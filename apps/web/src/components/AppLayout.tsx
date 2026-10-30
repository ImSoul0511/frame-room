import { NavLink, Outlet, Link } from 'react-router-dom';
import { Suspense } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { Action } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';

const icons = {
  explore: 'M12 3 3 8v8l9 5 9-5V8l-9-5Zm0 0v18M3 8l9 5 9-5',
  projects: 'M3 6h7l2 3h9v11H3V6Z',
  bookings: 'M5 3v4M19 3v4M3 10h18M3 5h18v16H3V5Z',
  studio: 'M3 21V8l9-5 9 5v13M8 21v-8h8v8',
  portfolio: 'M3 4h18v16H3V4Zm0 12 6-6 5 5 3-3 4 4',
  settings: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9v-3a7 7 0 0 1 14 0v3',
  admin: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z',
};
function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={icons[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function AppLayout() {
  const t = useStrings();

  const { session, profile } = useAuth();
  const pages = (Object.keys(t.nav) as (keyof typeof t.nav)[]).filter(
    (key) => key !== 'admin' || profile?.roles.includes('system_admin'),
  );
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        {t.continue}
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/explore">
          <span className="brand-mark">
            F<span>R</span>
          </span>
          <span>
            FrameRoom<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">F</span>
          <span>
            {t.personal}
            <small>{t.workspace}</small>
          </span>
          <span>⌄</span>
        </div>
        <p className="nav-caption">{t.workspace}</p>
        <nav aria-label={t.workspace}>
          {pages.map((key) => (
            <NavLink
              key={key}
              to={`/${key}`}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={key} />
              <span>{t.nav[key]}</span>
              {key === 'projects' ? <span className="nav-ai">AI</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sparkle">✧</span>
          <strong>{t.aiLabel}</strong>
          <p>{t.assistant.hint}</p>
          <Link to="/projects">{t.project.new} ↗</Link>
        </div>
        <div className="sidebar-footer">© {new Date().getFullYear()} FrameRoom</div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-title">
            {t.eyebrow}
            <span>/</span>
            <span>{t.workspace}</span>
          </div>
          <div className="topbar-actions">
            <LanguageSwitcher />
            <span className="live-indicator">{t.aiLabel}</span>
            {session ? (
              <>
                <span className="account-name">{profile?.displayName ?? session.user.email}</span>
                <span className="avatar">{(profile?.displayName ?? 'F').slice(0, 1)}</span>
                <Action secondary onClick={() => void supabase?.auth.signOut({ scope: 'local' })}>
                  {t.logout}
                </Action>
              </>
            ) : (
              <Link className="button-link dark" to="/auth">
                {t.login} ↗
              </Link>
            )}
          </div>
        </header>
        <main id="main" className="main-content">
          <Suspense fallback={<p role="status">{t.pending}</p>}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="page-footer">
          <span>
            {t.eyebrow} — {t.introduction}
          </span>
          <span>✧ {t.aiLabel}</span>
        </footer>
      </div>
    </div>
  );
}
