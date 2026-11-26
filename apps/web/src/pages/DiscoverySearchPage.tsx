import { SearchPagination } from '../features/catalog/SearchPagination';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { Action, Field, QueryState, Select } from '../components/ui';
import { PhotoDiscoveryGrid, type DiscoveryPhoto } from '../features/catalog/PhotoDiscoveryGrid';
import { TagFilterDialog } from '../features/catalog/TagFilterDialog';
import {
  PhotographerSearchCard,
  type SearchPhotographer,
} from '../features/catalog/PhotographerSearchCard';
import { ProvinceSelect } from '../features/catalog/ProvinceSelect';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import type { Tag } from '../lib/types';
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
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'style' ? 'style' : 'photographers';
  const query = (params.get('q') ?? '').trim();
  const city = params.get('city') ?? '';
  const genre = params.get('genre') ?? '';
  const priceMax = params.get('priceMax') ?? '';
  const ratingMin = params.get('ratingMin') ?? '';
  const sort = params.get('sort') ?? (mode === 'style' ? 'newest' : 'rating');
  const selectedTags = [
    ...new Set([...params.getAll('tag'), ...(params.get('tags') ?? '').split(',')].filter(Boolean)),
  ];
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftCity, setDraftCity] = useState(city);
  const [draftGenre, setDraftGenre] = useState(genre);
  const [draftPrice, setDraftPrice] = useState(priceMax);
  const [draftRating, setDraftRating] = useState(ratingMin);
  const [draftTags, setDraftTags] = useState(selectedTags);
  const tags = useApi<Tag[]>('/v1/tags', mode === 'style');
  const styleTags = (tags.data ?? []).filter((item) => item.category !== 'genre');
  const matchingStyle = query
    ? styleTags.find((item) =>
        [item.name, item.nameVi ?? '', item.slug].some((name) =>
          normalize(name).includes(normalize(query)),
        ),
      )
    : undefined;
  const activeTags = selectedTags.length ? selectedTags : matchingStyle ? [matchingStyle.slug] : [];
  const results = useInfiniteQuery({
    queryKey: ['api', 'discovery-search', mode, query, city, genre, activeTags, sort],
    enabled: mode === 'style' && tags.isSuccess,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      if (mode === 'style' && query && !activeTags.length)
        return Promise.resolve([] as DiscoveryPhoto[]);
      const queryParams = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(PAGE_SIZE),
      });
      if (city) queryParams.set('city', city);
      if (genre) queryParams.set('genre', genre);
      if (['newest', 'oldest', 'name'].includes(sort)) queryParams.set('sort', sort);
      if (activeTags.length === 1) queryParams.set('tag', activeTags[0]);
      else if (activeTags.length) queryParams.set('tags', activeTags.join(','));
      return api<DiscoveryPhoto[]>(`/v1/photos?${queryParams}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
  });
  const portfolios = [
    ...new Map((results.data?.pages.flat() ?? []).map((item) => [item.id, item])).values(),
  ];
  const photographers = useInfiniteQuery({
    queryKey: ['api', 'discovery-photographers', query, city, genre, priceMax, ratingMin, sort],
    enabled: mode === 'photographers',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const search = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      if (query) search.set('q', query);
      if (city) search.set('city', city);
      if (genre) search.set('genre', genre);
      if (priceMax) search.set('priceMax', priceMax);
      if (ratingMin) search.set('ratingMin', ratingMin);
      if (sort === 'price') search.set('sort', sort);
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
    next.delete('tags');
    next.delete('sort');
    setParams(next);
  };
  const activeQuery = mode === 'style' ? results : photographers;
  const resultCount = mode === 'style' ? portfolios.length : people.length;
  return (
    <section className="discovery-dashboard">
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
                ['priceMax', draftPrice],
                ['ratingMin', draftRating],
              ]) {
                if (value) next.set(key, value);
                else next.delete(key);
              }
              next.delete('tag');
              next.delete('tags');
              if (mode === 'style' && draftTags.length === 1) next.set('tag', draftTags[0]);
              else if (mode === 'style' && draftTags.length) next.set('tags', draftTags.join(','));
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
              <TagFilterDialog selected={draftTags} onChange={setDraftTags} />
            ) : (
              <>
                <Field
                  label={t.workspaceUi.maxPrice}
                  value={draftPrice}
                  onChange={(value) => setDraftPrice(value.replace(/[^0-9]/g, ''))}
                />
                <Select
                  label={t.workspaceUi.minRating}
                  value={draftRating}
                  onChange={setDraftRating}
                >
                  <option value="">{t.all}</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} ★
                    </option>
                  ))}
                </Select>
              </>
            )}
            <Action type="submit">{t.discovery.apply}</Action>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraftCity('');
                setDraftGenre('');
                setDraftPrice('');
                setDraftRating('');
                setDraftTags([]);
                const next = new URLSearchParams(params);
                next.delete('city');
                next.delete('genre');
                next.delete('priceMax');
                next.delete('ratingMin');
                next.delete('tag');
                next.delete('tags');
                setParams(next);
              }}
            >
              {t.explore.clear}
            </button>
          </form>
        </aside>
        <div className="discovery-results" aria-busy={activeQuery.isFetching}>
          {mode === 'style' && (
            <div className="discovery-sort">
              <Select
                label={t.workspaceUi.sortBy}
                value={sort}
                onChange={(value) => {
                  const next = new URLSearchParams(params);
                  if (['price', 'newest', 'oldest', 'name'].includes(value))
                    next.set('sort', value);
                  else next.delete('sort');
                  setParams(next);
                }}
              >
                {[
                  ['newest', t.design.newest],
                  ['oldest', t.design.oldest],
                  ['name', t.discovery.name],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          )}
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
            <PhotoDiscoveryGrid photos={portfolios} />
          )}
          <SearchPagination
            query={activeQuery}
            label={mode === 'style' ? t.site.loadMorePhotos : t.discovery.loadMorePhotographers}
          />
          {activeQuery.isSuccess && !activeQuery.hasNextPage && resultCount > 0 ? (
            <p className="discovery-end">{t.discovery.allLoaded}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
