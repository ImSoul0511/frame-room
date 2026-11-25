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
      {person.city || person.district || person.bio || person.genres.length ? (
        <div className="photographer-search-details">
          {person.city || person.district ? (
            <p>{[person.district, person.city].filter(Boolean).join(', ')}</p>
          ) : null}
          {person.bio ? <p className="photographer-search-bio">{person.bio}</p> : null}
          {person.genres.length ? (
            <p>
              {person.genres
                .slice(0, 3)
                .map((genre) => t.genreLabels[genre])
                .join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
