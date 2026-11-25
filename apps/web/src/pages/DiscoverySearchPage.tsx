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
  const label = (vi: string, en: string) => (language === 'vi' ? vi : en);
  return (
    <section className="discovery-layout">
      <aside className="discovery-sidebar">
        <div className="discovery-sidebar-header">
          <h1>{label('Kết quả tìm kiếm', 'Search results')}</h1>
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
              placeholder={t.discovery.searchPhotographersPlaceholder}
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
        <nav className="discovery-tabs" aria-label={label('Loại kết quả', 'Result type')}>
          <button
            type="button"
            className={mode === 'photographers' ? 'active' : ''}
            aria-current={mode === 'photographers' ? 'page' : undefined}
            onClick={() => changeMode('photographers')}
          >
            <span className="discovery-tab-icon" aria-hidden="true">
              ▧
            </span>
            {label('Nhiếp ảnh gia', 'Photographers')}
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
            {label('Phong cách', 'Styles')}
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
          <h2>{label('Bộ lọc', 'Filters')}</h2>
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
            <Select label={label('Phong cách', 'Style')} value={draftTag} onChange={setDraftTag}>
              <option value="">{t.all}</option>
              {styleTags.map((item) => (
                <option key={item.id} value={item.slug}>
                  {language === 'vi' ? item.nameVi || item.name : item.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Action type="submit">{label('Áp dụng', 'Apply')}</Action>
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
      <div className="discovery-results">
        <h2>
          {mode === 'style'
            ? label('Bộ ảnh theo phong cách', 'Collections by style')
            : label('Nhiếp ảnh gia', 'Photographers')}
        </h2>
        {query ? (
          <p className="discovery-query">
            {label('Kết quả cho', 'Results for')} “{query}”
          </p>
        ) : null}
        {mode === 'style' ? <QueryState query={tags} /> : null}
        <QueryState query={mode === 'style' ? results : photographers} />
        {(mode === 'style' && results.isSuccess && !portfolios.length) ||
        (mode === 'photographers' && photographers.isSuccess && !people.length) ? (
          <p className="empty-state">{t.explore.noResults}</p>
        ) : null}
        {mode === 'photographers' ? (
          <div className="photographer-search-list">
            {people.map((person) => (
              <PhotographerSearchCard key={person.id} person={person} />
            ))}
          </div>
        ) : (
          <div className="collection-grid">
            {portfolios.map((portfolio) => (
              <PortfolioCard
                key={portfolio.id}
                portfolio={portfolio}
                compact
                project={params.get('project')}
              />
            ))}
          </div>
        )}
        {(mode === 'style' ? results.hasNextPage : photographers.hasNextPage) ? (
          <div className="load-more">
            <Action
              secondary
              pending={
                mode === 'style' ? results.isFetchingNextPage : photographers.isFetchingNextPage
              }
              onClick={() =>
                void (mode === 'style' ? results.fetchNextPage() : photographers.fetchNextPage())
              }
            >
              {t.design.loadMore}
            </Action>
          </div>
        ) : null}
      </div>
    </section>
  );
}
