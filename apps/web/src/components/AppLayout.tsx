import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useStrings } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UserSearch } from './UserSearch';
import { NotificationBell } from './NotificationBell';
import { AccountMenu } from './AccountMenu';
import { useApi } from '../lib/hooks';
import { useMessageReadState } from '../features/messaging/readState';
import type { Conversation } from '../features/messaging/types';

export function AppLayout() {
  const t = useStrings();
  const { profile, session } = useAuth();
  const { pathname, search } = useLocation();
  const conversations = useApi<Conversation[]>('/v1/conversations', Boolean(session), 15000);
  const readMessages = useMessageReadState(session?.user.id);
  const hasUnreadMessages = conversations.data?.some(
    (item) =>
      item.latestIncomingMessageId && readMessages[item.id] !== item.latestIncomingMessageId,
  );
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  const professional = profile?.roles.some((role) =>
    ['photographer', 'studio_manager'].includes(role),
  );
  const pages = [
    { path: 'explore', label: t.workspaceUi.explore },
    ...(profile
      ? [
          { path: 'projects', label: t.nav.projects },
          { path: 'bookings', label: t.workspaceUi.bookings },
          { path: 'messages', label: t.workspaceUi.messages },
          ...(professional
            ? [
                { path: 'portfolio', label: t.workspaceUi.portfolio },
                { path: 'studio', label: t.nav.studio },
              ]
            : []),
          ...(profile.roles.includes('system_admin')
            ? [{ path: 'admin', label: t.workspaceUi.moderation }]
            : []),
        ]
      : []),
  ];
  return (
    <div className={`app-layout ${pathname === '/messages' ? 'app-layout-messages' : ''}`}>
      <a className="skip-link" href="#main">
        {t.discovery.skip}
      </a>
      <div className="app-body">
        <div className="site-navigation">
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
              <div className="topbar-actions">
                <LanguageSwitcher compact />
                <UserSearch key={pathname === '/search' ? search : 'other'} />
                <NotificationBell />
                {session ? (
                  <AccountMenu
                    key={pathname}
                    displayName={profile?.displayName ?? 'F'}
                    avatarPath={profile?.avatarPath}
                  />
                ) : (
                  <Link className="button-link dark" to="/auth">
                    {t.login}
                  </Link>
                )}
              </div>
            </div>
          </header>
          <div className="navigation-sticky">
            <div className="navigation-bar">
              <nav className="top-navigation primary-navigation" aria-label={t.workspace}>
                {pages.map((page) => (
                  <NavLink
                    key={page.path}
                    to={`/${page.path}`}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    {page.label}
                    {page.path === 'messages' && hasUnreadMessages ? (
                      <span
                        className="message-unread-dot"
                        aria-label={t.messaging.unreadMessages}
                      />
                    ) : null}
                  </NavLink>
                ))}
              </nav>
              {!session ? (
                <Link className="header-signup" to="/auth?mode=signup">
                  {t.signup}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
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
          <a className="text-button" href="#main">
            {t.design.backToTop}
          </a>
        </footer>
      </div>
    </div>
  );
}
