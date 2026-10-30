import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { genres, type Provider, type SearchResult } from '@frameroom/shared';
import { request, upload, currency } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { Action, Field, FilePicker, Feedback, QueryState } from '../components/ui';
import { useStrings } from '../lib/i18n';

type CardProvider = Provider & { coverUrl?: string | null };
type SearchResponse = {
  data: SearchResult[];
  parsedQuery: {
    genres: string[];
    styles: string[];
    city: string | null;
    district: string | null;
    priceMax: number | null;
  };
  meta: { total: number };
};
export function ExplorePage() {
  const t = useStrings();

  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const auth = useAuth();
  const filters = new URLSearchParams({
    ...(genre ? { genre } : {}),
    ...(city ? { city } : {}),
    ...(price ? { priceMax: price } : {}),
  });
  const providers = useApi<CardProvider[]>(`/v1/explore?${filters}`);
  const searchTask = useTask(async (ignore: string[]) => {
    if (!auth.session) {
      nav('/auth?next=/explore');
      return null;
    }
    return request<SearchResponse>('/v1/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        imageStoragePath: reference,
        filters: {
          ...(genre ? { genre } : {}),
          ...(city ? { city } : {}),
          ...(price ? { priceMax: Number(price) } : {}),
        },
        ignoreParsed: ignore,
      }),
    });
  });
  const referenceTask = useTask(async (file: File) => {
    if (!auth.session) {
      nav('/auth?next=/explore');
      return;
    }
    const result = await upload(file, 'search-uploads');
    setReference(result.storagePath);
  });
  const results = searchTask.data?.data;
  const projectParam = params.get('project');
  const clear = () => {
    setGenre('');
    setCity('');
    setPrice('');
    setReference(null);
    setIgnored([]);
    searchTask.reset();
  };
  return (
    <>
      <section className="explore-hero">
        <div className="hero-eyebrow">
          <span /> {t.explore.kicker}
        </div>
        <h1>
          {t.explore.title.split('\n').map((line, i) => (
            <span key={line} className={i === 1 ? 'serif-emphasis' : ''}>
              {line}
            </span>
          ))}
        </h1>
        <p>{t.explore.subtitle}</p>
        <form
          className="search-composer"
          onSubmit={(e) => {
            e.preventDefault();
            setIgnored([]);
            searchTask.mutate([]);
          }}
        >
          <label htmlFor="ai-search" className="sr-only">
            {t.explore.search}
          </label>
          <textarea
            id="ai-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.explore.placeholder}
            maxLength={300}
          />
          <div className="row between wrap">
            <FilePicker
              label={reference ? t.explore.referenceReady : t.explore.reference}
              disabled={referenceTask.isPending}
              onFile={(file) => referenceTask.mutate(file)}
            />
            <Action
              type="submit"
              pending={searchTask.isPending}
              disabled={!query.trim() && !reference}
            >
              {t.explore.search}
            </Action>
          </div>
        </form>
        <Feedback error={searchTask.error ?? referenceTask.error} />
        <div className="genre-chips">
          <button
            className={!genre ? 'chip selected' : 'chip'}
            onClick={() => {
              setGenre('');
              searchTask.reset();
            }}
          >
            {t.all}
          </button>
          {genres.map((g) => (
            <button
              key={g}
              className={`chip ${genre === g ? 'selected' : ''}`}
              onClick={() => {
                setGenre(g);
                searchTask.reset();
              }}
            >
              {t.genreLabels[g]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">{t.explore.browse}</p>
            <h2>{results ? t.explore.results : t.explore.recommended}</h2>
          </div>
          <button className="text-button" onClick={clear}>
            {t.explore.clear} ↗
          </button>
        </div>
        <div className="filter-bar">
          <Field
            label={t.city}
            value={city}
            onChange={(v) => {
              setCity(v);
              searchTask.reset();
            }}
          />
          <Field
            label={t.explore.priceMax}
            value={price}
            onChange={(v) => {
              setPrice(v.replace(/\D/g, ''));
              searchTask.reset();
            }}
          />
          <span className="muted">✧ {t.explore.indexNote}</span>
        </div>
        {searchTask.data ? (
          <div className="parsed-query">
            <span>{t.explore.parsed}</span>
            {(['genres', 'styles', 'city', 'district', 'priceMax'] as const)
              .filter(
                (k) =>
                  !ignored.includes(k) && Boolean(String(searchTask.data?.parsedQuery[k] ?? '')),
              )
              .map((k) => (
                <button
                  key={k}
                  className="chip"
                  onClick={() => {
                    const next = [...ignored, k];
                    setIgnored(next);
                    searchTask.mutate(next);
                  }}
                  aria-label={`${t.explore.removeFilter}: ${k}`}
                >
                  {String(searchTask.data?.parsedQuery[k])} ×
                </button>
              ))}
          </div>
        ) : null}
        {!results ? (
          <QueryState query={providers} empty={providers.data?.length === 0} />
        ) : results.length === 0 ? (
          <p className="empty-state">{t.explore.noResults}</p>
        ) : null}
        <div className="provider-grid">
          {(results ?? providers.data ?? []).map((item, i) => {
            const result = 'provider' in item ? item : null;
            const p = result ? result.provider : (item as CardProvider);
            const image = result?.matchedImages[0]?.url ?? (p as CardProvider).coverUrl;
            return (
              <article className="provider-card" key={p.id}>
                <Link
                  to={`/providers/${p.type}/${p.id}${projectParam ? `?project=${projectParam}` : ''}`}
                  className="provider-photo"
                  style={{ '--photo-index': i % 4 } as React.CSSProperties}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={result?.matchedImages[0]?.caption || p.displayName}
                      loading="lazy"
                    />
                  ) : (
                    <div className="portfolio-placeholder">
                      <span>{p.displayName.slice(0, 1)}</span>
                      <small>{t.explore[p.type]}</small>
                    </div>
                  )}
                  <span className="photo-type">{t.explore[p.type]}</span>
                  {result?.matchedImages[0]?.provenance === 'ai_generated' ? (
                    <span className="provenance">✧ {t.project.aiGenerated}</span>
                  ) : null}
                  <span className="photo-arrow">↗</span>
                </Link>
                <div className="provider-meta">
                  <div>
                    <Link to={`/providers/${p.type}/${p.id}`}>
                      <h3>{p.displayName}</h3>
                    </Link>
                    <p>
                      {p.city || t.eyebrow} <span>·</span>{' '}
                      {p.genres.map((g) => t.genreLabels[g]).join(', ')}
                    </p>
                  </div>
                  <span className="provider-rating">
                    {p.ratingAvg !== null ? `★ ${p.ratingAvg}` : '↗'}
                  </span>
                </div>
                <div className="provider-bottom">
                  <span>
                    {t.from} <strong>{currency(p.priceFrom)}</strong>
                  </span>
                  {result ? (
                    <details>
                      <summary>{Math.round(result.score * 100)}% ✧</summary>
                      <p>{result.reasons.join(' ')}</p>
                    </details>
                  ) : (
                    <span>
                      {p.reviewCount} {t.provider.rating}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
