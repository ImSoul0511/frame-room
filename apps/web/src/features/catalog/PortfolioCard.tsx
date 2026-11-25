import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Portfolio } from '../../lib/types';
import { useLanguage, useStrings } from '../../lib/i18n';
import { FittedImage } from '../../components/FittedImage';

export function PortfolioCard({
  portfolio,
  project,
  compact = false,
}: {
  portfolio: Portfolio;
  project?: string | null;
  compact?: boolean;
}) {
  const t = useStrings();
  const { language } = useLanguage();
  const [failed, setFailed] = useState(false);
  const providerId = portfolio.photographerId ?? portfolio.studioId;
  const tags = (portfolio.tags ?? []).filter(
    (tag) => tag.category !== 'genre' || tag.slug === portfolio.genre,
  );
  const renderTag = (tag: (typeof tags)[number]) => (
    <span className="card-tag" key={tag.id}>
      {language === 'vi' ? tag.nameVi || tag.name : tag.name}
    </span>
  );
  return (
    <article className={`collection-card${compact ? ' collection-card-compact' : ''}`}>
      <Link className="collection-image" to={`/portfolios/${portfolio.id}`}>
        {portfolio.coverUrl && !failed ? (
          <FittedImage
            src={portfolio.coverUrl}
            alt={portfolio.title}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="image-unavailable">{t.discovery.noImage}</span>
        )}
        <span className="collection-genre">
          {t.genreLabels[portfolio.genre as keyof typeof t.genreLabels]}
        </span>
      </Link>
      <div className="collection-body">
        <Link to={`/portfolios/${portfolio.id}`}>
          <h3>{portfolio.title}</h3>
        </Link>
        {portfolio.description ? <p>{portfolio.description}</p> : null}
        <div className="provider-tags">{tags.slice(0, compact ? 2 : 6).map(renderTag)}</div>
        {!compact && tags.length > 6 ? (
          <details className="more-tags">
            <summary>
              {t.design.allTags} ({tags.length})
            </summary>
            <div className="provider-tags">{tags.slice(6).map(renderTag)}</div>
          </details>
        ) : null}
        <div className="collection-links">
          <Link className="text-button" to={`/portfolios/${portfolio.id}`}>
            {t.profileUi.gallery}
          </Link>
          {providerId ? (
            <Link
              className="text-button"
              to={`/providers/${portfolio.ownerType}/${providerId}${project ? `?project=${encodeURIComponent(project)}` : ''}`}
            >
              {t.discovery.viewProfile}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
