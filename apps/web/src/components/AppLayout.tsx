import { Outlet, Link, useLocation } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useStrings } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UserSearch } from './UserSearch';
import { NotificationBell } from './NotificationBell';
import { AccountMenu } from './AccountMenu';
import { PrimaryNavigation } from './PrimaryNavigation';
import { ScrollHeader } from './ScrollHeader';
import { useApi } from '../lib/hooks';
import { useMessageReadState } from '../features/messaging/readState';
import type { Conversation } from '../features/messaging/types';

export function AppLayout() {
  const t = useStrings();
  const { profile, session } = useAuth();
  const { pathname, search, hash } = useLocation();
  const conversations = useApi<Conversation[]>('/v1/conversations', Boolean(session), 15000);
  const readMessages = useMessageReadState(session?.user.id);
  const hasUnreadMessages = conversations.data?.some(
    (item) =>
      item.latestIncomingMessageId && readMessages[item.id] !== item.latestIncomingMessageId,
  );
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return (
    <div className={`app-layout ${pathname === '/messages' ? 'app-layout-messages' : ''}`}>
      <a className="skip-link" href="#main">
        {t.discovery.skip}
      </a>
      <div className="app-body">
        <ScrollHeader key={pathname} fixed={pathname === '/messages'}>
          <div className="site-header">
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
                <LanguageSwitcher />
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
          </div>
          <div className="navigation-sticky">
            <div className="navigation-bar">
              <PrimaryNavigation key={pathname} />
              {!session ? (
                <Link className="header-signup" to="/auth?mode=signup">
                  {t.signup}
                </Link>
              ) : null}
            </div>
          </div>
        </ScrollHeader>
        <main id="main" className="main-content">
          <Suspense fallback={<p role="status">{t.pending}</p>}>
            <Outlet />
          </Suspense>
        </main>
        {pathname !== '/messages' ? (
          <Link className="floating-chat" to="/messages" aria-label={t.workspaceUi.messages}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.3-1.1L3 20l1.1-4.7A8.5 8.5 0 1 1 20.5 11.5Z" />
              <path d="M8 10h8M8 13h5" />
            </svg>
            {hasUnreadMessages ? (
              <span className="message-unread-dot" aria-label={t.messaging.unreadMessages} />
            ) : null}
          </Link>
        ) : null}
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
