import { useVisible } from '../features/catalog/use-visible';
import { SearchPagination } from '../features/catalog/SearchPagination';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { genres, type Provider } from '@frameroom/shared';
import { api } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { Action, Field, QueryState, Select } from '../components/ui';
import { ProviderCard } from '../features/catalog/ProviderCard';
import { ProvinceSelect } from '../features/catalog/ProvinceSelect';

export function ProviderDirectoryPage({ type }: { type: 'photographer' | 'studio' }) {
  const [params] = useSearchParams();
  return <ProviderDirectory type={type} key={`${type}:${params}`} />;
}

function ProviderDirectory({ type }: { type: 'photographer' | 'studio' }) {
  const t = useStrings();
  const { ref: resultsStart, visible } = useVisible<HTMLDivElement>();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const city = params.get('city') ?? '';
  const genre = params.get('genre') ?? '';
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftCity, setDraftCity] = useState(city);
  const [draftGenre, setDraftGenre] = useState(genre);
  const plural = type === 'studio' ? 'studios' : 'photographers';
  const pageSize = type === 'studio' ? 6 : 9;
  const results = useInfiniteQuery({
    queryKey: ['api', 'provider-directory', type, genre, city, query],
    enabled: visible,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ page: String(pageParam), pageSize: String(pageSize) });
      if (genre) query.set('genre', genre);
      if (city) query.set('city', city);
      if (params.get('q')?.trim()) query.set('q', params.get('q')!.trim());
      return api<Provider[]>(`/v1/${plural}?${query}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === pageSize ? pages.length + 1 : undefined),
  });
  const providers = [
    ...new Map(
      results.data?.pages.flat().map((provider) => [provider.id, provider]) ?? [],
    ).values(),
  ];
  return (
    <section className={`provider-directory directory-${plural}`}>
      <header className="directory-heading">
        <p className="eyebrow">{t.curation.directoryKicker}</p>
        <h1>{type === 'studio' ? t.curation.studioTitle : t.curation.photographerTitle}</h1>
        <p>
          {type === 'studio' ? t.curation.studioDescription : t.curation.photographerDescription}
        </p>
      </header>
      <form
        className="directory-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(params);
          for (const [key, value] of [
            ['q', draftQuery.trim().slice(0, 100)],
            ['city', draftCity],
            ['genre', draftGenre],
          ]) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          setParams(next);
        }}
      >
        <div className="directory-search-field">
          <Field
            label={t.discovery.userSearch}
            value={draftQuery}
            onChange={setDraftQuery}
            placeholder={t.discovery.searchPhotographersPlaceholder}
          />
        </div>
        <ProvinceSelect value={draftCity} onChange={setDraftCity} />
        <Select label={t.genres} value={draftGenre} onChange={setDraftGenre}>
          <option value="">{t.all}</option>
          {genres.map((value) => (
            <option key={value} value={value}>
              {t.genreLabels[value]}
            </option>
          ))}
        </Select>
        <Action type="submit">{t.curation.apply}</Action>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setDraftCity('');
            setDraftQuery('');
            setDraftGenre('');
            const next = new URLSearchParams(params);
            next.delete('q');
            next.delete('city');
            next.delete('genre');
            setParams(next);
          }}
        >
          {t.explore.clear}
        </button>
      </form>
      <div className="search-start" ref={resultsStart} />
      <QueryState query={results} />
      {results.isSuccess && !providers.length ? (
        <p className="empty-state">{t.explore.noResults}</p>
      ) : null}
      <div className="directory-grid">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
      <SearchPagination
        query={results}
        label={type === 'studio' ? t.discovery.loadMoreStudios : t.discovery.loadMorePhotographers}
      />
    </section>
  );
}
