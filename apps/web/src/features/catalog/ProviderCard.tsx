import { UserAvatar } from '../../components/UserAvatar';
import { useVisible } from './use-visible';
import { PortfolioCard } from './PortfolioCard';
import { Link, useSearchParams } from 'react-router-dom';
import type { Provider } from '@frameroom/shared';
import { useApi } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { currency } from '../../lib/format';
import type { ProviderDetail } from '../../lib/types';
import { QueryState } from '../../components/ui';

export function ProviderCard({
  provider,
}: {
  provider: Provider & { avatarPath?: string | null; userName?: string | null };
}) {
  const t = useStrings();
  const [params] = useSearchParams();
  const plural = provider.type === 'studio' ? 'studios' : 'photographers';
  const { ref, visible } = useVisible<HTMLElement>();
  const detail = useApi<ProviderDetail>(`/v1/${plural}/${provider.id}`, visible, undefined, 60_000);
  const portfolios = detail.data?.portfolios ?? [];
  const featured = portfolios.find((portfolio) => portfolio.coverUrl) ?? portfolios[0];
  const project = params.get('project');
  const destination = `/providers/${provider.type}/${encodeURIComponent(provider.type === 'photographer' ? (provider.userName ?? detail.data?.userName ?? provider.id) : provider.id)}${project ? `?project=${encodeURIComponent(project)}` : ''}`;
  return (
    <article className={`directory-card directory-card-${provider.type}`} ref={ref}>
      <div className="directory-featured" aria-label={t.curation.recentWork}>
        {featured ? (
          <PortfolioCard portfolio={{ ...featured, ownerName: provider.displayName }} />
        ) : (
          <div className="directory-no-photo">
            <p>{detail.isPending ? t.pending : t.curation.noWork}</p>
          </div>
        )}
      </div>
      <div className="directory-card-copy">
        <div className="directory-identity">
          <UserAvatar
            className="directory-monogram"
            name={provider.displayName}
            avatarPath={provider.avatarPath ?? detail.data?.avatarPath}
          />
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
        {detail.isError ? <QueryState query={detail} /> : null}
        <Link className="text-button emphasis-link" to={destination}>
          {t.discovery.viewProfile}
        </Link>
      </div>
    </article>
  );
}
