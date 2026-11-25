import { useVisible } from '../features/catalog/use-visible';
import { SearchPagination } from '../features/catalog/SearchPagination';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import type { Portfolio, Tag } from '../lib/types';
import { Action, Feedback, QueryState, Select } from '../components/ui';
import { Reveal } from '../components/Reveal';
import { PortfolioCard } from '../features/catalog/PortfolioCard';
import type { Genre } from '../features/catalog/genre-art';
import { useLanguage, useStrings } from '../lib/i18n';

const PAGE_SIZE = 12;
export function GenrePage() {
  const { genre } = useParams();
  if (!genres.includes(genre as Genre)) return <Navigate to="/genres/portrait" replace />;
  return <GenreCollection key={genre} genre={genre as Genre} />;
}
function GenreCollection({ genre }: { genre: Genre }) {
  const t = useStrings();
  const { ref: resultsStart, visible } = useVisible<HTMLDivElement>();
  const { language } = useLanguage();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('newest');
  const [tagsOpen, setTagsOpen] = useState(false);
  const tags = useApi<Tag[]>('/v1/tags', tagsOpen, undefined, 300_000);
  const collection = useInfiniteQuery({
    queryKey: ['api', 'explore-portfolios', keyword, genre, tag, sort],
    enabled: visible,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (keyword) query.set('q', keyword);
      if (genre) query.set('genre', genre);
      if (tag) query.set('tag', tag);
      return api<Portfolio[]>(`/v1/portfolios?${query}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
  });
  const displayed = collection.data?.pages.flat() ?? [];
  const secondaryTags = tags.data?.filter((value) => value.category !== 'genre') ?? [];
  const tagCategories = [...new Set(secondaryTags.map((value) => value.category || value.kind))];
  const labelTag = (value: Tag) => (language === 'vi' ? value.nameVi || value.name : value.name);
  const clear = () => {
    setTag('');
    setDraft('');
    setKeyword('');
    setSort('newest');
  };
  return (
    <div className="explore-page">
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
                <span className="section-highlight">{t.genreLabels[genre]}</span>
              </h1>
              <p className="section-description">{t.curation.genreDescription}</p>
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
            placeholder={t.design.searchPlaceholder}
            maxLength={120}
          />
          <Action type="submit">{t.explore.search}</Action>
        </form>
        <div className="genre-page-label">
          <span className="chip selected">{t.genreLabels[genre]}</span>
          <Link
            className="text-button"
            to={`/home${params.get('project') ? `?project=${encodeURIComponent(params.get('project')!)}` : ''}#genres`}
          >
            {t.curation.otherGenres}
          </Link>
        </div>
        <div className="collection-toolbar">
          <details
            className="taxonomy-filter"
            onToggle={(event) => setTagsOpen(event.currentTarget.open)}
          >
            <summary>
              {t.design.filterTags}
              {tag
                ? ` · ${labelTag(tags.data?.find((value) => value.slug === tag) ?? { id: '', slug: tag, name: tag, kind: 'mood' })}`
                : ''}
            </summary>
            <div className="taxonomy-groups">
              <button
                className={!tag ? 'chip selected' : 'chip'}
                onClick={() => setTag('')}
                aria-pressed={!tag}
              >
                {t.all}
              </button>
              {tagCategories.map((category) => (
                <fieldset key={category}>
                  <legend>
                    {t.design.tagCategories[category as keyof typeof t.design.tagCategories] ??
                      category}
                  </legend>
                  <div className="genre-chips">
                    {secondaryTags
                      .filter((value) => (value.category || value.kind) === category)
                      .map((value) => (
                        <button
                          key={value.id}
                          className={tag === value.slug ? 'chip selected' : 'chip'}
                          aria-pressed={tag === value.slug}
                          onClick={() => setTag(tag === value.slug ? '' : value.slug)}
                        >
                          {labelTag(value)}
                        </button>
                      ))}
                  </div>
                </fieldset>
              ))}
              <QueryState query={tags} />
            </div>
          </details>
          <Select label={t.discovery.sort} value={sort} onChange={setSort}>
            <option value="newest">{t.design.newest}</option>
            <option value="oldest">{t.design.oldest}</option>
            <option value="name">{t.discovery.name}</option>
          </Select>
        </div>
        <div className="search-start" ref={resultsStart} />
        <QueryState query={collection} />
        {!displayed.length && collection.isSuccess ? (
          <p className="empty-state">{t.explore.noResults}</p>
        ) : null}
        <div className="collection-grid media-grid">
          {displayed.map((portfolio, index) => (
            <Reveal key={portfolio.id} delay={(index % 3) * 70}>
              <PortfolioCard portfolio={portfolio} />
            </Reveal>
          ))}
        </div>
        <div className="load-more">
          <span className="muted" role="status" aria-live="polite">
            {displayed.length} {t.design.collectionsLoaded}
          </span>
          <SearchPagination query={collection} />
          <Feedback error={collection.isFetchNextPageError ? collection.error : null} />
        </div>
      </section>
    </div>
  );
}
