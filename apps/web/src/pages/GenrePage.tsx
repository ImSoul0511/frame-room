import { SearchPagination } from '../features/catalog/SearchPagination';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { api } from '../lib/api';

import { Action, Feedback, QueryState, Select } from '../components/ui';
import { Reveal } from '../components/Reveal';
import { PhotoDiscoveryGrid, type DiscoveryPhoto } from '../features/catalog/PhotoDiscoveryGrid';
import { TagFilterDialog } from '../features/catalog/TagFilterDialog';
import type { Genre } from '../features/catalog/genre-art';
import { useStrings } from '../lib/i18n';

const PAGE_SIZE = 12;
export function GenrePage() {
  const { genre } = useParams();
  return (
    <GenreCollection
      key={genre ?? 'all'}
      genre={genres.includes(genre as Genre) ? (genre as Genre) : undefined}
    />
  );
}
function GenreCollection({ genre }: { genre?: Genre }) {
  const t = useStrings();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState('newest');
  const collection = useInfiniteQuery({
    queryKey: ['api', 'discovery-photos', keyword, genre, selectedTags, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (keyword) query.set('q', keyword);
      if (genre) query.set('genre', genre);
      if (selectedTags.length) query.set('tags', selectedTags.join(','));
      return api<DiscoveryPhoto[]>(`/v1/photos?${query}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
  });
  const displayed = collection.data?.pages.flat() ?? [];
  const clear = () => {
    setSelectedTags([]);
    setDraft('');
    setKeyword('');
    setSort('newest');
  };
  return (
    <div className="explore-page photo-explore-page">
      <section
        id="collections"
        className="photographer-collection"
        aria-labelledby="collection-title"
      >
        <Reveal>
          <div className="section-header">
            <div>
              <p className="eyebrow">{t.curation.genreKicker}</p>
              <h1 id="collection-title">
                <span className="section-highlight">
                  {genre ? t.genreLabels[genre] : t.site.photoExploreTitle}
                </span>
              </h1>
              <p className="section-description">{t.site.photoExploreDescription}</p>
            </div>
            <button className="text-button" onClick={clear}>
              {t.explore.clear}
            </button>
          </div>
        </Reveal>
        <form
          className="collection-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setKeyword(draft.trim());
          }}
        >
          <label className="sr-only" htmlFor="collection-search">
            {t.explore.search}
          </label>
          <input
            id="collection-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t.site.photoSearchPlaceholder}
            maxLength={120}
          />
          <Action type="submit">{t.explore.search}</Action>
        </form>
        <div className="collection-toolbar photo-discovery-toolbar">
          <div className="photo-genre-filter">
            <Select
              label={t.genres}
              value={genre ?? ''}
              onChange={(value) =>
                navigate(
                  `${value ? `/genres/${value}` : '/inspiration'}${params.get('project') ? `?project=${encodeURIComponent(params.get('project')!)}` : ''}`,
                )
              }
            >
              <option value="">{t.all}</option>
              {genres.map((value) => (
                <option key={value} value={value}>
                  {t.genreLabels[value]}
                </option>
              ))}
            </Select>
          </div>
          <TagFilterDialog selected={selectedTags} onChange={setSelectedTags} />
          <Select label={t.discovery.sort} value={sort} onChange={setSort}>
            <option value="newest">{t.design.newest}</option>
            <option value="oldest">{t.design.oldest}</option>
            <option value="name">{t.discovery.name}</option>
          </Select>
        </div>
        <div className="search-start" />
        <QueryState query={collection} />
        {!displayed.length && collection.isSuccess ? (
          <p className="empty-state">{t.explore.noResults}</p>
        ) : null}
        <PhotoDiscoveryGrid photos={displayed} />
        <div className="load-more">
          <span className="muted" role="status" aria-live="polite">
            {displayed.length} {t.site.photosLoaded}
          </span>
          <SearchPagination query={collection} label={t.site.loadMorePhotos} />
          <Feedback error={collection.isFetchNextPageError ? collection.error : null} />
        </div>
      </section>
    </div>
  );
}
