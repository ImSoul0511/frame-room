import { Link, useSearchParams } from 'react-router-dom';
import type { Provider } from '@frameroom/shared';
import { UserAvatar } from '../../components/UserAvatar';
import { useStrings } from '../../lib/i18n';

export type SearchPhotographer = Provider & {
  userName?: string | null;
  avatarPath?: string | null;
};

export function PhotographerSearchCard({ person }: { person: SearchPhotographer }) {
  const t = useStrings();
  const [params] = useSearchParams();
  const project = params.get('project');
  const destination = `/providers/photographer/${person.id}${project ? `?project=${encodeURIComponent(project)}` : ''}`;
  return (
    <article className="photographer-search-card">
      <Link className="photographer-search-link" to={destination}>
        <UserAvatar
          className="photographer-search-avatar"
          name={person.displayName}
          avatarPath={person.avatarPath}
        />
        <span className="photographer-search-identity">
          <strong>{person.displayName}</strong>
          {person.userName ? <span>@{person.userName}</span> : null}
        </span>
      </Link>
      <div className="photographer-card-body">
        <p className="photographer-card-location">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {[person.district, person.city].filter(Boolean).join(', ') || t.discovery.locationUnknown}
        </p>
        <p className="photographer-search-bio">{person.bio || t.profileUi.noBio}</p>
        {person.genres.length ? (
          <div className="photographer-card-genres">
            {person.genres.slice(0, 3).map((genre) => (
              <span key={genre}>{t.genreLabels[genre]}</span>
            ))}
          </div>
        ) : null}
      </div>
      <Link className="photographer-card-profile" to={destination}>
        {t.discovery.viewProfile}
        <span className="sr-only">: {person.displayName}</span>
      </Link>
    </article>
  );
}
