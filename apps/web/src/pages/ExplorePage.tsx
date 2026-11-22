import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import type { Portfolio, Tag } from '../lib/types';
import { Action, Feedback, QueryState, Select } from '../components/ui';
import { Botanical, WatercolorWash } from '../components/Botanical';
import { Reveal } from '../components/Reveal';
import { PortfolioCard } from '../features/catalog/PortfolioCard';
import { ExploreIntro } from '../features/catalog/ExploreIntro';
import { useLanguage, useStrings } from '../lib/i18n';

const PAGE_SIZE = 12;
export function ExplorePage() {
  const t = useStrings();
  const { language } = useLanguage();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [genre, setGenre] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('newest');
  const tags = useApi<Tag[]>('/v1/tags');
  const introduction = useApi<Portfolio[]>('/v1/portfolios?pageSize=9');
  const collection = useInfiniteQuery({
    queryKey: ['api', 'explore-portfolios', keyword, genre, tag, sort],
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
  const tagCategories = [...new Set(tags.data?.map((value) => value.category || value.kind) ?? [])];
  const chooseGenre = (value: string) => {
    setGenre(value);
    document.getElementById('collections')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  const labelTag = (value: Tag) => (language === 'vi' ? value.nameVi || value.name : value.name);
  const clear = () => {
    setGenre('');
    setTag('');
    setDraft('');
    setKeyword('');
    setSort('newest');
  };
  return (
    <div className="explore-page">
      <section className="editorial-hero">
        <WatercolorWash />
        <Botanical className="hero-flower-left" meadow />
        <Botanical className="hero-flower-right" meadow />
        <Reveal className="hero-content">
          <p className="eyebrow">{t.discovery.heroKicker}</p>
          <h1>
            {t.discovery.heroFirst}
            <em>{t.discovery.heroSecond}</em>
          </h1>
          <p className="hero-description">{t.discovery.heroDescription}</p>
          <a className="button-link hero-cta emphasis-link" href="#collections">
            {t.design.browsePhotos}
          </a>
        </Reveal>
      </section>
      <ExploreIntro portfolios={introduction.data ?? []} onGenre={chooseGenre} />
      <section
        id="collections"
        className="photographer-collection"
        aria-labelledby="collection-title"
      >
        <Reveal>
          <div className="section-header">
            <div>
              <p className="eyebrow">{t.design.collectionKicker}</p>
              <h2 id="collection-title">
                <span className="section-highlight">{t.design.collectionTitle}</span>
              </h2>
              <p className="section-description">{t.design.collectionDescription}</p>
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
        <div className="genre-chips" aria-label={t.genres}>
          <button
            className={!genre ? 'chip selected' : 'chip'}
            aria-pressed={!genre}
            onClick={() => setGenre('')}
          >
            {t.all}
          </button>
          {genres.map((value) => (
            <button
              key={value}
              className={genre === value ? 'chip selected' : 'chip'}
              aria-pressed={genre === value}
              onClick={() => setGenre(value)}
            >
              {t.genreLabels[value]}
            </button>
          ))}
        </div>
        <div className="collection-toolbar">
          <details className="taxonomy-filter">
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
                    {tags.data
                      ?.filter((value) => (value.category || value.kind) === category)
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
        <QueryState query={collection} />
        {!displayed.length && collection.isSuccess ? (
          <p className="empty-state">{t.explore.noResults}</p>
        ) : null}
        <div className="collection-grid">
          {displayed.map((portfolio, index) => (
            <Reveal key={portfolio.id} delay={(index % 3) * 70}>
              <PortfolioCard portfolio={portfolio} project={params.get('project')} />
            </Reveal>
          ))}
        </div>
        <div className="load-more">
          <span className="muted" role="status" aria-live="polite">
            {displayed.length} {t.design.collectionsLoaded}
          </span>
          {collection.hasNextPage ? (
            <Action
              secondary
              pending={collection.isFetchingNextPage}
              onClick={() => {
                void collection.fetchNextPage();
              }}
            >
              {t.design.loadMore}
            </Action>
          ) : null}
          <Feedback error={collection.isFetchNextPageError ? collection.error : null} />
        </div>
      </section>
    </div>
  );
}
