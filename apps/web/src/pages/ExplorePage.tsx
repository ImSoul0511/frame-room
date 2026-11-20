import { Link, useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { useDiscovery } from '../lib/discovery';
import { useApi } from '../lib/hooks';
import { Action, Feedback, QueryState, Select } from '../components/ui';
import { AtelierHero } from '../features/catalog/AtelierHero';
import { VisualSearch } from '../features/catalog/VisualSearch';
import { ProviderCard } from '../features/catalog/ProviderCard';
import { useLanguage, useStrings } from '../lib/i18n';

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
  const [params, setParams] = useSearchParams();
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const query = params.get('q') ?? '';
  const genre = params.get('genre') ?? '';
  const city = params.get('city') ?? '';
  const price = params.get('priceMax') ?? '';
  const sort = params.get('sort') ?? 'recommended';
  const providerType = params.get('type') ?? '';
  const submitted = query || null;
  const setQuery = (value: string) => update('q', value);
  const setGenre = (value: string) => update('genre', value);
  const setCity = (value: string) => update('city', value);
  const setPrice = (value: string) => update('priceMax', value);
  const setSort = (value: string) => update('sort', value === 'recommended' ? '' : value);
  const setProviderType = (value: string) => update('type', value);
  const providers = useDiscovery();
  const tags = useApi<Tag[]>('/v1/tags');
  const source = providers.data ?? [];
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
  const clear = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams();
        if (current.get('project')) next.set('project', current.get('project')!);
        return next;
      },
      { replace: true },
    );
  const chooseGenre = (value: string) => {
    setGenre(value);
  };
  return (
    <>
      <AtelierHero />
      <div className="saved-directory-link">
        <Link
          className="atelier-text-link"
          to={`/saved${params.get('project') ? `?project=${encodeURIComponent(params.get('project')!)}` : ''}`}
        >
          {t.tools.exploreSaved} <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
      <section className="discovery-search" aria-labelledby="provider-search-heading">
        <div className="search-introduction">
          <p className="eyebrow">{t.atelier.directory}</p>
          <h2 id="provider-search-heading">{t.atelier.directoryTitle}</h2>
          <p>{t.discovery.searchDescription}</p>
        </div>
        <div className="search-workspace">
          <form
            className="search-composer"
            onSubmit={(event) => {
              event.preventDefault();
              document.getElementById('photographers')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <label htmlFor="provider-search" className="sr-only">
              {t.explore.search}
            </label>
            <textarea
              id="provider-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.explore.placeholder}
              maxLength={300}
            />
            <div className="row">
              <Action type="submit" disabled={!query.trim() && submitted === null}>
                {t.explore.search}
              </Action>
            </div>
          </form>
        </div>
      </section>
      <VisualSearch
        project={params.get('project')}
        filters={{
          ...(genre ? { genre } : {}),
          ...(city ? { city } : {}),
          ...(price ? { priceMax: Number(price) } : {}),
        }}
      />
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
        {!displayed.length && !providers.isPending && !providers.error ? (
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
