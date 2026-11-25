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
import { ChatLauncher } from '../features/messaging/ChatLauncher';
import { DetailBack, PageFooter, ScrollToTop } from './PageNavigation';

export function AppLayout() {
  const t = useStrings();
  const { profile, session, loading } = useAuth();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return (
    <div className={`app-layout ${pathname === '/messages' ? 'app-layout-messages' : ''}`}>
      <a className="skip-link" href="#main">
        {t.discovery.skip}
      </a>
      <div className="app-body">
        <div className="site-header">
          <div className="masthead">
            <Link className="brand" to="/home" aria-label="FrameRoom">
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
              <UserSearch />
              <NotificationBell />
              {session ? (
                <AccountMenu
                  key={pathname}
                  displayName={profile?.displayName ?? 'F'}
                  avatarPath={profile?.avatarPath}
                />
              ) : !loading ? (
                <div className="masthead-auth">
                  <Link to="/auth">{t.login}</Link>
                  <Link className="button-link dark" to="/auth?mode=signup">
                    {t.signup}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <ScrollHeader key={pathname} fixed={pathname === '/messages'}>
          <div className="navigation-sticky">
            <div className="navigation-bar">
              <PrimaryNavigation key={pathname} />
            </div>
          </div>
        </ScrollHeader>
        <main id="main" className="main-content">
          <DetailBack />
          <Suspense fallback={<p role="status">{t.pending}</p>}>
            <Outlet />
          </Suspense>
        </main>
        {pathname !== '/messages' && (
          <>
            <ScrollToTop />
            <ChatLauncher key={session?.user.id ?? 'guest'} />
            <PageFooter />
          </>
        )}
      </div>
    </div>
  );
}
