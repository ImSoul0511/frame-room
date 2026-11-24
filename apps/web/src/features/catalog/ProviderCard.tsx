import { Link, useSearchParams } from 'react-router-dom';
import type { Provider } from '@frameroom/shared';
import { useApi } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { currency } from '../../lib/format';
import type { Image, ProviderDetail } from '../../lib/types';
import { QueryState } from '../../components/ui';

export function ProviderCard({ provider }: { provider: Provider }) {
  const t = useStrings();
  const [params] = useSearchParams();
  const plural = provider.type === 'studio' ? 'studios' : 'photographers';
  const detail = useApi<ProviderDetail>(`/v1/${plural}/${provider.id}`);
  const portfolios = detail.data?.portfolios ?? [];
  const covers = portfolios.filter((portfolio) => portfolio.coverUrl).slice(0, 3);
  const firstPortfolio = portfolios[0]?.id;
  const gallery = useApi<{ images: Image[] }>(
    `/v1/portfolios/${firstPortfolio ?? ''}`,
    Boolean(firstPortfolio) && covers.length < 3,
  );
  const pictures = [
    ...new Map([
      ...covers.map(
        (portfolio) =>
          [
            portfolio.coverUrl!,
            { url: portfolio.coverUrl!, title: portfolio.title, id: portfolio.id },
          ] as const,
      ),
      ...(gallery.data?.images ?? []).map(
        (image) =>
          [
            image.url,
            { url: image.url, title: image.caption || portfolios[0].title, id: firstPortfolio! },
          ] as const,
      ),
    ]).values(),
  ].slice(0, 3);
  const project = params.get('project');
  const destination = `/providers/${provider.type}/${provider.id}${project ? `?project=${encodeURIComponent(project)}` : ''}`;
  return (
    <article className={`directory-card directory-card-${provider.type}`}>
      <div className="directory-photos" aria-label={t.curation.recentWork}>
        {pictures.map((picture, index) => (
          <Link
            className={`directory-photo photo-${index}`}
            key={picture.url}
            to={`/portfolios/${picture.id}`}
          >
            <img src={picture.url} alt={picture.title} loading="lazy" decoding="async" />
          </Link>
        ))}
        {!pictures.length ? (
          <div className="directory-no-photo">
            <span>FrameRoom.</span>
            <p>
              {detail.isPending || (firstPortfolio && gallery.isPending)
                ? t.pending
                : t.curation.noWork}
            </p>
          </div>
        ) : null}
      </div>
      <div className="directory-card-copy">
        <div className="directory-identity">
          <span className="directory-monogram" aria-hidden="true">
            {provider.displayName.slice(0, 1)}
          </span>
          <div>
            <p className="eyebrow">
              {provider.type === 'studio' ? t.curation.studios : t.curation.photographers}
            </p>
            <h2>
              <Link to={destination}>{provider.displayName}</Link>
            </h2>
          </div>
        </div>
        {provider.city || provider.district ? (
          <p className="directory-location">
            <svg
              width="16"
              height="18"
              viewBox="0 0 16 20"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M14 7c0 5-6 11-6 11S2 12 2 7a6 6 0 1 1 12 0Z" />
              <circle cx="8" cy="7" r="2" />
            </svg>
            {[provider.district, provider.city].filter(Boolean).join(', ')}
          </p>
        ) : null}
        {provider.bio ? <p className="directory-bio">{provider.bio}</p> : null}
        <div className="provider-tags">
          {provider.genres.map((genre) => (
            <Link
              className="card-tag"
              key={genre}
              to={`/genres/${genre}${project ? `?project=${encodeURIComponent(project)}` : ''}`}
            >
              {t.genreLabels[genre]}
            </Link>
          ))}
          {provider.styles.slice(0, 3).map((style) => (
            <span className="card-tag" key={style}>
              {style}
            </span>
          ))}
        </div>
        <div className="directory-card-footer">
          {provider.priceFrom !== null ? (
            <span>
              {t.curation.from} <strong>{currency(provider.priceFrom)}</strong>
            </span>
          ) : (
            <span>{t.contactPrice}</span>
          )}
          {provider.ratingAvg !== null && provider.reviewCount > 0 ? (
            <span>
              ☆ {provider.ratingAvg.toFixed(1)} · {provider.reviewCount} {t.curation.reviews}
            </span>
          ) : null}
        </div>
        <QueryState query={detail} />
        {gallery.isError ? <QueryState query={gallery} /> : null}
        <Link className="text-button emphasis-link" to={destination}>
          {t.discovery.viewProfile}
        </Link>
      </div>
    </article>
  );
}
