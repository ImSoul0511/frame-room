import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStrings } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/api';
import { useTask } from '../lib/hooks';
import { Feedback } from './ui';

export function ProfileLayout() {
  const t = useStrings();
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useTask(async () => {
    const result = await supabase?.auth.signOut({ scope: 'local' });
    if (result?.error) throw result.error;
    navigate('/home');
  });
  {
    const isAccountPage = [
      '/profile',
      '/settings',
      '/notifications',
      '/studio',
      '/admin',
      '/bookings',
      '/projects',
      '/portfolio',
    ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (!isAccountPage) return <Outlet />;
    return (
      <section className="profile-workspace photographer-workspace" aria-label={t.design.profile}>
        <aside className="photographer-account-sidebar">
          <nav className="photographer-account-nav" aria-label={t.design.profile}>
            <NavLink to="/profile">{t.design.profile}</NavLink>
            <NavLink to="/studio">{t.nav.studio}</NavLink>
            <NavLink to="/bookings">{t.workspaceUi.bookings}</NavLink>
            <NavLink to="/projects">{t.project.title}</NavLink>
            {profile?.roles.some((role) => ['photographer', 'studio_manager'].includes(role)) && (
              <NavLink to="/portfolio">{t.workspaceUi.portfolioNav}</NavLink>
            )}
            <NavLink to="/notifications">{t.workspaceUi.notifications}</NavLink>
            <NavLink to="/settings">{t.workspaceUi.settings}</NavLink>
            {profile?.roles.includes('system_admin') ? (
              <NavLink to="/admin">{t.workspaceUi.moderation}</NavLink>
            ) : null}
            <div className="photographer-logout-box">
              <button
                className="text-button"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                {logout.isPending ? t.pending : t.logout}
              </button>
            </div>
          </nav>
          <Feedback error={logout.error} />
        </aside>
        <div className="photographer-account-content">
          <Outlet />
        </div>
      </section>
    );
  }
}
