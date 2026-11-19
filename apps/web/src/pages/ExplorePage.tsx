import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { Action, FilePicker, Feedback, QueryState, Select } from '../components/ui';
import { Botanical } from '../components/Botanical';
import { ProviderCard, type CardProvider } from '../features/catalog/ProviderCard';
import { useLanguage, useStrings } from '../lib/i18n';
import { useDemo, useDemoTask } from '../features/demo/DemoContext';
import { getDemoProviderCards } from '../features/demo/public-catalog';

type Tag = {
  id: string;
  slug: string;
  name: string;
  nameVi?: string | null;
  category?: string | null;
};
export function ExplorePage() {
  const t = useStrings();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [sort, setSort] = useState('recommended');
  const [providerType, setProviderType] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [params] = useSearchParams();
  const demo = useDemo();
  const referenceTask = useDemoTask();
  const providers = useQuery({
    queryKey: ['api', 'discovery-cards'],
    queryFn: async ({ signal }) => {
      const cards: CardProvider[] = [];
      let page = 1;
      for (;;) {
        const batch = await api<CardProvider[]>(`/v1/explore?pageSize=50&page=${page}`, { signal });
        cards.push(...batch);
        if (batch.length < 50) return cards;
        page += 1;
      }
    },
  });
  const tags = useApi<Tag[]>('/v1/tags');
  const source = [
    ...(providers.data ?? []),
    ...getDemoProviderCards(demo.state, demo.text, demo.image),
  ];
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLocaleLowerCase(language);
  const availableTags = (tags.data ?? []).filter((tag) =>
    genres.includes(tag.slug as (typeof genres)[number]),
  );
  const genreOptions = availableTags.length
    ? availableTags.map((tag) => ({
        slug: tag.slug,
        label:
          language === 'vi'
            ? (tag.nameVi ?? t.genreLabels[tag.slug as (typeof genres)[number]])
            : tag.name,
      }))
    : [...new Set(source.flatMap((p) => p.genres))].map((slug) => ({
        slug,
        label: t.genreLabels[slug],
      }));
  const displayed = source
    .filter(
      (provider) =>
        (!providerType || provider.type === providerType) &&
        (!submitted ||
          normalize(
            [
              provider.displayName,
              provider.bio,
              provider.city,
              ...provider.styles,
              ...provider.genres.flatMap((value) => [value, t.genreLabels[value]]),
            ].join(' '),
          ).includes(normalize(submitted.trim()))) &&
        (!genre || provider.genres.includes(genre as (typeof genres)[number])) &&
        (!city || provider.city === city) &&
        (!price || (provider.priceFrom !== null && provider.priceFrom <= Number(price))),
    )
    .sort((a, b) => {
      if (sort === 'name') return a.displayName.localeCompare(b.displayName, language);
      if (sort === 'rating') return (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1);
      if (sort === 'priceLow' || sort === 'priceHigh') {
        if (a.priceFrom === null) return b.priceFrom === null ? 0 : 1;
        if (b.priceFrom === null) return -1;
        return sort === 'priceLow' ? a.priceFrom - b.priceFrom : b.priceFrom - a.priceFrom;
      }
      return 0;
    });
  const clear = () => {
    setGenre('');
    setCity('');
    setPrice('');
    setSort('recommended');
    setQuery('');
    setReference(null);
    setSubmitted(null);
    setProviderType('');
    referenceTask.clear();
  };
  const chooseGenre = (value: string) => {
    setGenre(value);
  };
  return (
    <>
      <section className="editorial-hero">
        <Botanical className="hero-flower-left" />
        <Botanical className="hero-flower-right" />
        <div className="hero-content">
          <p className="eyebrow">{t.discovery.heroKicker}</p>
          <h1>
            {t.discovery.heroFirst}
            <em>{t.discovery.heroSecond}</em>
          </h1>
          <p className="hero-description">{t.discovery.heroDescription}</p>
          <a className="button-link hero-cta" href="#photographers">
            {t.discovery.browse}
          </a>
        </div>
      </section>
      <section className="discovery-search" aria-labelledby="idea-heading">
        <div className="search-introduction">
          <p className="eyebrow">{t.discovery.searchKicker}</p>
          <h2 id="idea-heading">{t.discovery.searchTitle}</h2>
          <p>{t.discovery.searchDescription}</p>
        </div>
        <div className="search-workspace">
          <form
            className="search-composer"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(query.trim());
            }}
          >
            <label htmlFor="ai-search" className="sr-only">
              {t.explore.search}
            </label>
            <textarea
              id="ai-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.explore.placeholder}
              maxLength={300}
            />
            <div className="row between wrap">
              <FilePicker
                label={reference ? t.explore.referenceReady : t.explore.reference}
                onFile={(file) =>
                  referenceTask.attempt(() => {
                    const value = demo.file(file);
                    setReference(value.name);
                  })
                }
              />
              <Action type="submit" disabled={!query.trim() && !reference}>
                {t.explore.search}
              </Action>
            </div>
          </form>
          {reference ? <p className="muted">{reference}</p> : null}
          <Feedback error={referenceTask.error} />
        </div>
      </section>
      <section
        id="photographers"
        className="photographer-collection"
        aria-labelledby="collection-title"
      >
        <div className="section-header">
          <div>
            <p className="eyebrow">{t.discovery.collectionKicker}</p>
            <h2 id="collection-title">
              {submitted !== null ? t.explore.results : t.discovery.collectionTitle}
            </h2>
          </div>
          <button className="text-button" onClick={clear}>
            {t.explore.clear}
          </button>
        </div>
        <div className="genre-chips" aria-label={t.genres}>
          <button
            className={genre ? 'chip' : 'chip selected'}
            aria-pressed={!genre}
            onClick={() => chooseGenre('')}
          >
            {t.all}
          </button>
          {genreOptions.map((tag) => (
            <button
              key={tag.slug}
              className={genre === tag.slug ? 'chip selected' : 'chip'}
              aria-pressed={genre === tag.slug}
              onClick={() => chooseGenre(tag.slug)}
            >
              {tag.label}
            </button>
          ))}
        </div>
        <Feedback error={tags.error} />
        <div className="filter-bar">
          <Select label={t.demo.providerType} value={providerType} onChange={setProviderType}>
            <option value="">{t.all}</option>
            <option value="photographer">{t.explore.photographer}</option>
            <option value="studio">{t.explore.studio}</option>
          </Select>
          <Select label={t.city} value={city} onChange={setCity}>
            <option value="">{t.discovery.allCities}</option>
            {[...new Set(source.map((p) => p.city).filter(Boolean))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <div className="native-field">
            <label htmlFor="max-price">{t.explore.priceMax}</label>
            <input
              id="max-price"
              type="number"
              min="0"
              step="100000"
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="VND"
            />
          </div>
          <Select label={t.discovery.sort} value={sort} onChange={setSort}>
            {(['recommended', 'name', 'priceLow', 'priceHigh', 'rating'] as const).map((value) => (
              <option key={value} value={value}>
                {t.discovery[value]}
              </option>
            ))}
          </Select>
          <span className="result-count" role="status" aria-live="polite">
            {displayed.length} {t.discovery.count}
          </span>
        </div>
        <QueryState query={providers} />
        {!displayed.length && !providers.isLoading ? (
          <p className="empty-state">{t.explore.noResults}</p>
        ) : null}
        <div className="provider-grid">
          {displayed.map((provider, index) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              index={index}
              project={params.get('project')}
              onGenre={chooseGenre}
            />
          ))}
        </div>
      </section>
    </>
  );
}
