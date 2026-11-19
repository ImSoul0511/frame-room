import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Provider } from '@frameroom/shared';
import { currency } from '../../lib/api';
import { useStrings } from '../../lib/i18n';

export type CardProvider = Provider & { coverUrl?: string | null; isDemo?: boolean };
export function ProviderCard({
  provider,
  index,
  project,
  onGenre,
}: {
  provider: CardProvider;
  index: number;
  project?: string | null;
  onGenre: (genre: string) => void;
}) {
  const t = useStrings();
  const [failedImage, setFailedImage] = useState(false);
  const path = `/providers/${provider.type}/${provider.id}${project ? `?project=${encodeURIComponent(project)}` : ''}`;
  return (
    <article className={`provider-card card-tone-${index % 3}`}>
      <Link
        to={path}
        className="provider-photo"
        aria-label={`${t.discovery.viewProfile}: ${provider.displayName}`}
      >
        {provider.coverUrl && !failedImage ? (
          <img
            src={provider.coverUrl}
            alt={provider.displayName}
            loading="lazy"
            onError={() => setFailedImage(true)}
          />
        ) : (
          <div className="portfolio-placeholder">
            <svg className="placeholder-frame" viewBox="0 0 180 180" fill="none" aria-hidden="true">
              <rect
                x="20"
                y="20"
                width="140"
                height="140"
                rx="70"
                stroke="currentColor"
                strokeWidth=".6"
              />
              <rect
                x="30"
                y="10"
                width="120"
                height="160"
                rx="60"
                stroke="currentColor"
                strokeWidth=".6"
                transform="rotate(25 90 90)"
              />
            </svg>
            <span>
              {provider.displayName
                .split(' ')
                .filter(Boolean)
                .slice(-2)
                .map((part) => part[0])
                .join('')}
            </span>
            <small>{t.discovery.noImage}</small>
          </div>
        )}
        <span className="photo-type">
          {t.explore[provider.type]}
          {provider.isDemo ? ` · ${t.demo.demo}` : ''}
        </span>
      </Link>
      <div className="provider-card-content">
        <div className="provider-meta">
          <div>
            <Link to={path}>
              <h3>{provider.displayName}</h3>
            </Link>
            <p>{provider.city || t.explore[provider.type]}</p>
          </div>
          {provider.ratingAvg !== null ? (
            <span className="provider-rating">
              ★ {provider.ratingAvg.toFixed(1)} <small>({provider.reviewCount})</small>
            </span>
          ) : null}
        </div>
        <div className="provider-tags">
          {provider.genres.map((genre) => (
            <button key={genre} className="card-tag" onClick={() => onGenre(genre)}>
              {t.genreLabels[genre]}
            </button>
          ))}
          {provider.styles.slice(0, 2).map((style) => (
            <span key={style} className="card-tag">
              {style}
            </span>
          ))}
        </div>
        <div className="provider-bottom">
          <span>
            {provider.priceFrom === null ? (
              t.contactPrice
            ) : (
              <>
                {t.from} <strong>{currency(provider.priceFrom)}</strong>
              </>
            )}
          </span>
          <Link to={path}>{t.discovery.viewProfile}</Link>
        </div>
      </div>
    </article>
  );
}
