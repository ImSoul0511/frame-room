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
    navigate('/explore');
  });
  const professional = profile?.roles.some((role) =>
    ['photographer', 'studio_manager'].includes(role),
  );
  if (pathname === '/messages') return <Outlet />;
  return (
    <section className="profile-workspace" aria-label={t.design.profile}>
      <nav className="profile-navigation" aria-label={t.design.profile}>
        <NavLink to="/profile">{t.design.profile}</NavLink>
        <NavLink to="/projects">{t.nav.projects}</NavLink>
        <NavLink to="/bookings">{t.workspaceUi.bookings}</NavLink>
        {professional ? (
          <>
            <NavLink to="/portfolio">{t.workspaceUi.portfolio}</NavLink>
            <NavLink to="/studio">{t.nav.studio}</NavLink>
          </>
        ) : null}
        <NavLink to="/notifications">{t.workspaceUi.notifications}</NavLink>
        {profile?.roles.includes('system_admin') ? (
          <NavLink to="/admin">{t.workspaceUi.moderation}</NavLink>
        ) : null}
        <NavLink to="/settings">{t.workspaceUi.settings}</NavLink>
        <button
          className="text-button profile-logout"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          {logout.isPending ? t.pending : t.logout}
        </button>
      </nav>
      <Feedback error={logout.error} />
      <Outlet />
    </section>
  );
}
