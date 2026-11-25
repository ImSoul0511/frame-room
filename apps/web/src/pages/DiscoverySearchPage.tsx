import { SearchPagination } from '../features/catalog/SearchPagination';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { Action, QueryState, Select } from '../components/ui';
import { PortfolioCard } from '../features/catalog/PortfolioCard';
import {
  PhotographerSearchCard,
  type SearchPhotographer,
} from '../features/catalog/PhotographerSearchCard';
import { ProvinceSelect } from '../features/catalog/ProvinceSelect';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useLanguage, useStrings } from '../lib/i18n';
import type { Portfolio, Tag } from '../lib/types';
import '../discovery.css';

const PAGE_SIZE = 12;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

export function DiscoverySearchPage() {
  const [params] = useSearchParams();
  return <DiscoverySearch key={params.toString()} />;
}

function DiscoverySearch() {
  const t = useStrings();
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'style' ? 'style' : 'photographers';
  const query = (params.get('q') ?? '').trim();
  const city = params.get('city') ?? '';
  const genre = params.get('genre') ?? '';
  const tag = params.get('tag') ?? '';
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftCity, setDraftCity] = useState(city);
  const [draftGenre, setDraftGenre] = useState(genre);
  const [draftTag, setDraftTag] = useState(tag);
  const tags = useApi<Tag[]>('/v1/tags', mode === 'style');
  const styleTags = (tags.data ?? []).filter((item) => item.category !== 'genre');
  const matchingStyle = query
    ? styleTags.find((item) =>
        [item.name, item.nameVi ?? '', item.slug].some((name) =>
          normalize(name).includes(normalize(query)),
        ),
      )
    : undefined;
  const selectedTag = tag || matchingStyle?.slug;
  const results = useInfiniteQuery({
    queryKey: ['api', 'discovery-search', mode, query, city, genre, selectedTag],
    enabled: mode === 'style' && tags.isSuccess,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      if (mode === 'style' && query && !tag && !matchingStyle)
        return Promise.resolve([] as Portfolio[]);
      const queryParams = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(PAGE_SIZE),
      });
      if (city) queryParams.set('city', city);
      if (genre) queryParams.set('genre', genre);
      if (mode === 'style' && selectedTag) queryParams.set('tag', selectedTag);
      return api<Portfolio[]>(`/v1/portfolios?${queryParams}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
  });
  const portfolios = [
    ...new Map((results.data?.pages.flat() ?? []).map((item) => [item.id, item])).values(),
  ];
  const photographers = useInfiniteQuery({
    queryKey: ['api', 'discovery-photographers', query, city, genre],
    enabled: mode === 'photographers',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const search = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      if (query) search.set('q', query);
      if (city) search.set('city', city);
      if (genre) search.set('genre', genre);
      return api<SearchPhotographer[]>(`/v1/photographers?${search}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
  });
  const people = [
    ...new Map(
      (photographers.data?.pages.flat() ?? []).map((person) => [person.id, person]),
    ).values(),
  ];
  const changeMode = (nextMode: 'photographers' | 'style') => {
    const next = new URLSearchParams(params);
    if (nextMode === 'style') next.set('mode', 'style');
    else next.delete('mode');
    next.delete('tag');
    setParams(next);
  };
  const activeQuery = mode === 'style' ? results : photographers;
  const resultCount = mode === 'style' ? portfolios.length : people.length;
  return (
    <section className="discovery-dashboard">
      <header className="discovery-heading">
        <p className="eyebrow">{t.nav.explore} / FrameRoom</p>
        <h1>{t.discovery.title}</h1>
        <p>{t.discovery.description}</p>
      </header>
      <div className="discovery-layout">
        <aside className="discovery-sidebar">
          <div className="discovery-sidebar-header">
            <h2>{t.discovery.searchResults}</h2>
            <form
              className="discovery-sidebar-search"
              role="search"
              aria-label={t.discovery.userSearch}
              onSubmit={(event) => {
                event.preventDefault();
                const next = new URLSearchParams(params);
                const value = draftQuery.trim();
                if (value) next.set('q', value);
                else next.delete('q');
                setParams(next);
              }}
            >
              <label className="sr-only" htmlFor="discovery-sidebar-query">
                {t.discovery.userSearch}
              </label>
              <input
                id="discovery-sidebar-query"
                type="search"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                maxLength={100}
                placeholder={mode === 'style' ? t.discovery.searchStyles : t.discovery.searchNames}
              />
              <button type="submit" aria-label={t.discovery.userSearch}>
                <svg
                  viewBox="0 0 24 24"
                  width="19"
                  height="19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 5 5" />
                </svg>
              </button>
            </form>
          </div>
          <nav className="discovery-tabs" aria-label={t.discovery.resultType}>
            <button
              type="button"
              className={mode === 'photographers' ? 'active' : ''}
              aria-current={mode === 'photographers' ? 'page' : undefined}
              onClick={() => changeMode('photographers')}
            >
              <span className="discovery-tab-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
                </svg>
              </span>
              {t.discovery.photographers}
            </button>
            <button
              type="button"
              className={mode === 'style' ? 'active' : ''}
              aria-current={mode === 'style' ? 'page' : undefined}
              onClick={() => changeMode('style')}
            >
              <span className="discovery-tab-icon" aria-hidden="true">
                ✦
              </span>
              {t.discovery.styles}
            </button>
          </nav>
          <form
            className="directory-filters"
            onSubmit={(event) => {
              event.preventDefault();
              const next = new URLSearchParams(params);
              for (const [key, value] of [
                ['city', draftCity],
                ['genre', draftGenre],
                ['tag', mode === 'style' ? draftTag : ''],
              ]) {
                if (value) next.set(key, value);
                else next.delete(key);
              }
              setParams(next);
            }}
          >
            <h2>{t.discovery.filters}</h2>
            <ProvinceSelect value={draftCity} onChange={setDraftCity} />
            <Select label={t.genres} value={draftGenre} onChange={setDraftGenre}>
              <option value="">{t.all}</option>
              {genres.map((value) => (
                <option key={value} value={value}>
                  {t.genreLabels[value]}
                </option>
              ))}
            </Select>
            {mode === 'style' ? (
              <Select label={t.discovery.style} value={draftTag} onChange={setDraftTag}>
                <option value="">{t.all}</option>
                {styleTags.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {language === 'vi' ? item.nameVi || item.name : item.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Action type="submit">{t.discovery.apply}</Action>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraftCity('');
                setDraftGenre('');
                setDraftTag('');
                const next = new URLSearchParams(params);
                next.delete('city');
                next.delete('genre');
                next.delete('tag');
                setParams(next);
              }}
            >
              {t.explore.clear}
            </button>
          </form>
        </aside>
        <div className="discovery-results" aria-busy={activeQuery.isFetching}>
          <header className="discovery-results-heading">
            <div>
              <h2>
                {mode === 'style' ? t.discovery.collectionsByStyle : t.discovery.photographers}
              </h2>
              <p>{mode === 'style' ? t.discovery.styleHint : t.discovery.photographerHint}</p>
            </div>
            {activeQuery.isSuccess ? (
              <p className="discovery-result-count" role="status">
                <strong>{resultCount}</strong>
                {mode === 'style' ? t.discovery.loadedCollections : t.discovery.loadedPhotographers}
              </p>
            ) : null}
          </header>
          {query ? (
            <p className="discovery-query">
              {t.discovery.resultsFor} “{query}”
            </p>
          ) : null}
          {mode === 'style' ? <QueryState query={tags} /> : null}
          {mode !== 'style' || tags.isSuccess ? <QueryState query={activeQuery} /> : null}
          {(mode === 'style' && results.isSuccess && !portfolios.length) ||
          (mode === 'photographers' && photographers.isSuccess && !people.length) ? (
            <p className="empty-state" role="status">
              {t.explore.noResults}
            </p>
          ) : null}
          {mode === 'photographers' ? (
            <div className="photographer-search-list">
              {people.map((person) => (
                <PhotographerSearchCard key={person.id} person={person} />
              ))}
            </div>
          ) : (
            <div className="collection-grid media-grid">
              {portfolios.map((portfolio) => (
                <PortfolioCard key={portfolio.id} portfolio={portfolio} />
              ))}
            </div>
          )}
          <SearchPagination
            query={activeQuery}
            label={mode === 'style' ? t.design.loadMore : t.discovery.loadMorePhotographers}
          />
          {activeQuery.isSuccess && !activeQuery.hasNextPage && resultCount > 0 ? (
            <p className="discovery-end">{t.discovery.allLoaded}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
