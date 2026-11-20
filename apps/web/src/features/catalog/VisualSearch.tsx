import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SearchResult } from '@frameroom/shared';
import { Action, Area, Feedback, FilePicker, Provenance } from '../../components/ui';
import { post, upload } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { useCapabilities } from '../../lib/capabilities';
import { useStrings } from '../../lib/i18n';

export function VisualSearch({
  project,
  filters,
}: {
  project: string | null;
  filters: { genre?: string; city?: string; priceMax?: number };
}) {
  const t = useStrings();
  const { session } = useAuth();
  const capabilities = useCapabilities();
  const [query, setQuery] = useState('');
  const [reference, setReference] = useState<{ path: string; name: string } | null>(null);
  const add = useTask(async (file: File) => {
    const result = await upload(file, 'search-uploads');
    setReference({ path: result.storagePath, name: file.name });
  });
  const search = useTask(async () =>
    post<SearchResult[]>('/v1/search', {
      query,
      imageStoragePath: reference?.path ?? null,
      filters,
    }),
  );
  return (
    <details className="atelier-visual-search">
      <summary>
        {t.atelier.searchTools} <span aria-hidden="true">↗</span>
      </summary>
      {!capabilities.data?.aiSearchEnabled ? (
        <p role="status">{t.atelier.searchUnavailable}</p>
      ) : !session ? (
        <Link
          className="atelier-text-link"
          to={`/auth?next=${encodeURIComponent(`/explore${project ? `?project=${encodeURIComponent(project)}` : ''}`)}`}
        >
          {t.login}
        </Link>
      ) : (
        <>
          <Area
            label={t.project.idea}
            value={query}
            onChange={setQuery}
            placeholder={t.explore.placeholder}
          />
          <div className="row wrap">
            <FilePicker
              label={t.project.addReference}
              disabled={add.isPending || search.isPending}
              onFile={(file) => add.mutate(file)}
            />
            <Action
              pending={search.isPending}
              disabled={add.isPending || (!query.trim() && !reference)}
              onClick={() => search.mutate()}
            >
              {t.explore.search}
            </Action>
          </div>
          {reference ? (
            <p>
              {reference.name}{' '}
              <button className="text-button" onClick={() => setReference(null)}>
                {t.delete}
              </button>
            </p>
          ) : null}
          <Feedback error={add.error ?? search.error} />
          {search.data?.length === 0 ? <p role="status">{t.explore.noResults}</p> : null}
          <div className="atelier-match-grid">
            {search.data?.map((match) => (
              <article key={match.provider.id}>
                <Link
                  to={`/providers/${match.provider.type}/${match.provider.id}${project ? `?project=${encodeURIComponent(project)}` : ''}`}
                >
                  {match.matchedImages[0] ? (
                    <img
                      src={match.matchedImages[0].url}
                      alt={match.matchedImages[0].caption || match.provider.displayName}
                    />
                  ) : null}
                  <h3>{match.provider.displayName}</h3>
                </Link>
                {match.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
                {match.matchedImages[0] ? (
                  <Provenance value={match.matchedImages[0].provenance} />
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </details>
  );
}
