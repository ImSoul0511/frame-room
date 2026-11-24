import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { genres, type Provider } from '@frameroom/shared';
import { api } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { Action, Field, QueryState, Select } from '../components/ui';
import { ProviderCard } from '../features/catalog/ProviderCard';

export function ProviderDirectoryPage({ type }: { type: 'photographer' | 'studio' }) {
  const t = useStrings();
  const [genre, setGenre] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [city, setCity] = useState('');
  const plural = type === 'studio' ? 'studios' : 'photographers';
  const pageSize = type === 'studio' ? 6 : 9;
  const results = useInfiniteQuery({
    queryKey: ['api', 'provider-directory', type, genre, city],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ page: String(pageParam), pageSize: String(pageSize) });
      if (genre) query.set('genre', genre);
      if (city) query.set('city', city);
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
          setCity(draftCity.trim());
        }}
      >
        <Field
          label={t.curation.city}
          value={draftCity}
          onChange={setDraftCity}
          placeholder={t.curation.cityPlaceholder}
        />
        <Select label={t.genres} value={genre} onChange={setGenre}>
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
            setCity('');
            setGenre('');
          }}
        >
          {t.explore.clear}
        </button>
      </form>
      <QueryState query={results} />
      {results.isSuccess && !providers.length ? (
        <p className="empty-state">{t.explore.noResults}</p>
      ) : null}
      <div className="directory-grid">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
      {results.hasNextPage ? (
        <div className="load-more">
          <Action
            secondary
            pending={results.isFetchingNextPage}
            onClick={() => void results.fetchNextPage()}
          >
            {t.curation.explore}
          </Action>
        </div>
      ) : null}
    </section>
  );
}
