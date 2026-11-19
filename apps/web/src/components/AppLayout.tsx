import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { Suspense } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { useTask } from '../lib/hooks';
import { Action, Feedback } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UserSearch } from './UserSearch';
import { useDemo } from '../features/demo/DemoContext';
import { getNavigation } from '../features/demo/permissions';
import { WorkspaceControls } from '../features/demo/WorkspaceControls';

export function AppLayout() {
  const t = useStrings();
  const { profile } = useAuth();
  const demo = useDemo();
  const navigate = useNavigate();
  const logout = useTask(async () => {
    if (demo.choice !== 'account') {
      demo.setRole('guest');
      navigate('/explore');
      return;
    }
    const result = await supabase?.auth.signOut({ scope: 'local' });
    if (result?.error) throw result.error;
  });
  const primaryPages = getNavigation(demo.role);
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        {t.discovery.skip}
      </a>
      <div className="app-body">
        <header className="site-header">
          <div className="masthead">
            <Link className="brand" to="/explore" aria-label="FrameRoom">
              <svg
                width="34"
                height="34"
                viewBox="0 0 34 34"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                <path d="M1 11V1h10M23 1h10v10M33 23v10H23M11 33H1V23" />
                <circle cx="17" cy="17" r="8" />
                <circle cx="17" cy="17" r="3" />
              </svg>
              <span>
                FrameRoom<span className="brand-dot">.</span>
              </span>
            </Link>
            <nav className="top-navigation primary-navigation" aria-label={t.workspace}>
              {primaryPages.map((key) => (
                <NavLink
                  key={key}
                  to={`/${key}`}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  {key === 'admin'
                    ? t.demo.moderation
                    : key === 'projects'
                      ? t.nav.projects
                      : t.demo[key]}
                </NavLink>
              ))}
            </nav>
            <div className="topbar-actions">
              <LanguageSwitcher />
              {demo.role !== 'guest' ? (
                <>
                  <Link className="account-link" to="/profile">
                    <span className="avatar">
                      {(demo.choice === 'account'
                        ? (profile?.displayName ?? 'F')
                        : demo.text(demo.state.profiles[demo.role]?.name ?? 'F')
                      ).slice(0, 1)}
                    </span>
                    <span className="account-name">
                      {demo.choice === 'account'
                        ? (profile?.displayName ?? t.profileUi.account)
                        : demo.text(demo.state.profiles[demo.role]?.name ?? demo.role)}
                    </span>
                  </Link>
                  <Action secondary pending={logout.isPending} onClick={() => logout.mutate()}>
                    {demo.choice === 'account' ? t.logout : t.demo.exitDemo}
                  </Action>
                </>
              ) : (
                <>
                  <Link
                    className="header-signup"
                    to="/auth?mode=signup"
                    onClick={() => demo.setRole('account')}
                  >
                    {t.signup}
                  </Link>
                  <Link
                    className="button-link dark"
                    to="/auth"
                    onClick={() => demo.setRole('account')}
                  >
                    {t.login}
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="navigation-bar">
            <WorkspaceControls />
            <UserSearch />
          </div>
          <Feedback error={logout.error} />
        </header>
        <main id="main" className="main-content">
          <Suspense fallback={<p role="status">{t.pending}</p>}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="page-footer">
          <Link className="footer-brand" to="/explore">
            FrameRoom.
          </Link>
          <span>{t.discovery.footer}</span>
          <span>© {new Date().getFullYear()} FrameRoom</span>
        </footer>
      </div>
    </div>
  );
}
