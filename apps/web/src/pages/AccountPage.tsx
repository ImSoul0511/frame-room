import { Link } from 'react-router-dom';
import type { OwnPhotographer } from '@frameroom/shared';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { QueryState } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';

export function AccountPage() {
  const t = useStrings();
  const { profile, session } = useAuth();
  const isPhotographer = Boolean(profile?.roles.includes('photographer'));
  const isProfessional = Boolean(
    profile?.roles.some((role) => role === 'photographer' || role === 'studio_manager'),
  );
  const photographer = useApi<OwnPhotographer | null>('/v1/photographers/me', isPhotographer);
  const own = photographer.data;
  return (
    <div className="account-page">
      <header className="account-profile-heading">
        <UserAvatar
          name={profile?.displayName ?? ''}
          avatarPath={profile?.avatarPath}
          className="profile-monogram"
        />
        <div>
          <p className="eyebrow">{t.profileUi.account}</p>
          <h1>{profile?.displayName}</h1>
          <p className="muted">@{profile?.userName}</p>
          <Link className="text-button" to="/settings">
            {t.profileUi.chooseAvatar}
          </Link>
        </div>
      </header>
      <div className="account-profile-columns">
        <div>
          <section className="profile-section">
            <h2>{t.profileUi.about}</h2>
            {isPhotographer ? <QueryState query={photographer} /> : null}
            <p className="profile-biography">{own?.bio || t.profileUi.accountDescription}</p>
            <dl className="profile-facts">
              <div>
                <dt>{t.email}</dt>
                <dd>{session?.user.email}</dd>
              </div>
              <div>
                <dt>{t.role}</dt>
                <dd>{isPhotographer ? t.photographer : t.client}</dd>
              </div>
              {own?.city ? (
                <div>
                  <dt>{t.city}</dt>
                  <dd>{own.city}</dd>
                </div>
              ) : null}
            </dl>
            {own?.genres.length ? (
              <div className="profile-tags">
                {own.genres.map((genre) => (
                  <span key={genre} className="card-tag">
                    {t.genreLabels[genre]}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
          {isProfessional ? (
            <section className="profile-section">
              <h2>{t.profileUi.profileLinks}</h2>
              <p className="muted">{t.profileUi.profileLinksDescription}</p>
              <div className="account-quick-links">
                <Link to="/portfolio">{t.portfolio.title}</Link>
                <Link to="/bookings">{t.workspaceUi.bookings}</Link>
                <Link to="/studio">{t.nav.studio}</Link>
              </div>
            </section>
          ) : null}
        </div>
        <aside className="profile-aside">
          <section className="profile-summary">
            <h3>{t.profileUi.privacy}</h3>
            <p>{t.profileUi.privateProfile}</p>
          </section>
          {own ? (
            <section className="profile-inquiry">
              <h3>{t.profileUi.publicProfile}</h3>
              <p>{own.displayName}</p>
              <Link className="button-link" to={`/providers/photographer/${own.id}`}>
                {t.view}
              </Link>
            </section>
          ) : null}
          <section className="profile-summary">
            <h3>{t.profileUi.security}</h3>
            <p>{t.profileUi.passwordDescription}</p>
            <Link className="text-button" to="/auth?mode=reset">
              {t.forgot}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
