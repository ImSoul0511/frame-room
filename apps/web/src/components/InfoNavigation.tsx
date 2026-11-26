import { NavLink } from 'react-router-dom';
import { useStrings } from '../lib/i18n';

export function InfoNavigation() {
  const t = useStrings();
  return (
    <nav className="info-navigation" aria-label={t.site.resources}>
      <NavLink to="/about">{t.curation.about}</NavLink>
      <NavLink to="/support">{t.site.supportShort}</NavLink>
      <NavLink to="/community">{t.site.communityShort}</NavLink>
      <NavLink to="/privacy">{t.site.privacyShort}</NavLink>
    </nav>
  );
}
