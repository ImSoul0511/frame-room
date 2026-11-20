import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { useTask } from '../lib/hooks';
import { Action, Feedback } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
export function AppLayout() {
  const t = useStrings();
  const { session, profile } = useAuth();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenu(false);
  }
  const logout = useTask(async () => {
    const result = await supabase?.auth.signOut({ scope: 'local' });
    if (result?.error) throw result.error;
  });
  const professional = profile?.roles.includes('photographer');
  const links = [
    { to: '/explore', label: t.nav.explore },
    ...(session
      ? [
          { to: '/projects', label: t.atelier.board },
          { to: '/bookings', label: t.booking.title },
          { to: '/calendar', label: t.tools.calendar },
          { to: '/saved', label: t.tools.saved },
          { to: '/messages', label: t.demo.messages },
        ]
      : []),
    ...(professional
      ? [
          { to: '/portfolio', label: t.demo.portfolio },
          { to: '/studio', label: t.nav.studio },
        ]
      : []),
    ...(profile?.roles.includes('system_admin')
      ? [{ to: '/admin', label: t.demo.moderation }]
      : []),
  ];
  return (
    <div className="app-layout atelier-layout">
      <a className="skip-link" href="#main">
        {t.discovery.skip}
      </a>
      <header className="atelier-header">
        <div className="atelier-masthead">
          <Link className="atelier-brand" to="/explore" aria-label="FrameRoom">
            <span className="atelier-brand-mark" aria-hidden="true">
              fr
            </span>
            <span>
              FrameRoom<span className="brand-dot">.</span>
              <small>{t.atelier.signature}</small>
            </span>
          </Link>
          <div className="atelier-account">
            <LanguageSwitcher />
            {session ? (
              <>
                <Link
                  className="atelier-inbox"
                  to="/notifications"
                  aria-label={t.demo.notifications}
                >
                  ↗
                </Link>
                <Link className="atelier-avatar" to="/profile" aria-label={t.profileUi.account}>
                  {(profile?.displayName ?? 'F').slice(0, 1)}
                </Link>
              </>
            ) : (
              <Link className="atelier-signin" to="/auth">
                {t.login} <span aria-hidden="true">↗</span>
              </Link>
            )}
            <button
              className="atelier-menu"
              aria-expanded={menu}
              aria-controls="atelier-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? t.atelier.closeMenu : t.atelier.menu}
            </button>
          </div>
        </div>
        <nav
          id="atelier-navigation"
          className={`atelier-navigation ${menu ? 'is-open' : ''}`}
          aria-label={t.workspace}
        >
          <div>
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={() => setMenu(false)}>
                {link.label}
              </NavLink>
            ))}
          </div>
          <span className="atelier-nav-note">{t.atelier.frameNote}</span>
          {session ? (
            <div className="atelier-mobile-account">
              <Link to="/settings">{t.profileUi.security}</Link>
              <Action secondary pending={logout.isPending} onClick={() => logout.mutate()}>
                {t.logout}
              </Action>
            </div>
          ) : null}
        </nav>
        <Feedback error={logout.error} />
      </header>
      <main id="main" className="main-content atelier-main">
        <Suspense
          fallback={
            <p className="loading" role="status">
              {t.pending}
            </p>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <footer className="atelier-footer">
        <Link className="atelier-footer-logo" to="/explore">
          FrameRoom.
        </Link>
        <span>{t.atelier.signature}</span>
        <span>© {new Date().getFullYear()} FrameRoom</span>
      </footer>
    </div>
  );
}
