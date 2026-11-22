import { NavLink, Outlet } from 'react-router-dom';
import { useStrings } from '../lib/i18n';

export function ProfileLayout() {
  const t = useStrings();
  return (
    <section className="profile-workspace" aria-label={t.design.profile}>
      <nav className="profile-navigation" aria-label={t.design.profile}>
        <NavLink to="/profile">{t.design.profile}</NavLink>
        <NavLink to="/settings">{t.workspaceUi.settings}</NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
