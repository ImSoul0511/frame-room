import { useEffect, useRef } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { useStrings } from '../lib/i18n';
import { useAuth } from '../lib/auth';

export function PrimaryNavigation() {
  const t = useStrings();
  const { profile } = useAuth();
  const isPhotographer = Boolean(profile?.roles.includes('photographer'));
  const [params] = useSearchParams();
  const project = params.get('project');
  const destination = (path: string) =>
    `${path}${project ? `?project=${encodeURIComponent(project)}` : ''}`;
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      nav.current?.querySelectorAll('details[open]').forEach((item) => {
        if (!item.contains(event.target as Node)) item.removeAttribute('open');
      });
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return (
    <nav
      className={`top-navigation primary-navigation${isPhotographer ? ' photographer-primary-navigation' : ''}`}
      ref={nav}
      aria-label={t.workspace}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          const details = (event.target as HTMLElement).closest('details');
          details?.removeAttribute('open');
          details?.querySelector('summary')?.focus();
        }
      }}
    >
      <NavLink to={destination('/home')} end>
        {t.curation.home}
      </NavLink>
      {isPhotographer ? (
        <>
          <NavLink to={destination('/inspiration')}>{t.curation.explore}</NavLink>
          <NavLink to="/projects">{t.nav.projects}</NavLink>
          <NavLink to="/bookings">{t.workspaceUi.bookings}</NavLink>
          <NavLink to="/portfolio">{t.workspaceUi.portfolioNav}</NavLink>
        </>
      ) : (
        <>
          <NavLink to={destination('/explore')}>{t.curation.explore}</NavLink>
          {profile ? (
            <>
              <NavLink to="/bookings">{t.workspaceUi.bookings}</NavLink>
              <NavLink to="/projects">{t.nav.projects}</NavLink>
            </>
          ) : (
            <details className="nav-disclosure nav-genres" name="primary-navigation">
              <summary>
                {t.curation.genres}
                <span className="nav-chevron" aria-hidden="true" />
              </summary>
              <div className="nav-panel nav-genre-panel">
                {genres.map((genre) => (
                  <NavLink key={genre} to={destination(`/genres/${genre}`)}>
                    {t.genreLabels[genre]}
                  </NavLink>
                ))}
              </div>
            </details>
          )}
        </>
      )}
      <NavLink to="/about">{t.curation.about}</NavLink>
    </nav>
  );
}
