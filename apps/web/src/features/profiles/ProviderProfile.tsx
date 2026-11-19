import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { ProviderDetail } from '../../lib/types';
import { currency } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { Action } from '../../components/ui';
import { useDemo } from '../demo/DemoContext';
import { DemoReportButton } from '../demo/ReportButton';

export function ProviderProfile({
  detail,
  onBook,
  onContact,
  canRequest = true,
}: {
  detail: ProviderDetail;
  onBook: (service: Service) => void;
  onContact?: () => void;
  canRequest?: boolean;
}) {
  const t = useStrings();
  const demo = useDemo();
  const { provider, services } = detail;
  const portfolios = detail.portfolios.filter(
    (value) => !demo.state.hiddenTargets.includes(value.id),
  );
  const reviews = detail.reviews.filter((value) => !demo.state.hiddenTargets.includes(value.id));
  const [tab, setTab] = useState('works');
  const cover = portfolios.find((portfolio) => portfolio.coverUrl)?.coverUrl;
  return (
    <div className="public-profile">
      <div className={`profile-cover ${!cover ? 'profile-cover-empty' : ''}`}>
        {cover ? (
          <img src={cover} alt={provider.displayName} />
        ) : (
          <span aria-hidden="true">FrameRoom.</span>
        )}
        <span className="profile-kind">{t.explore[provider.type]}</span>
      </div>
      <header className="profile-identity">
        <div className="profile-monogram" aria-hidden="true">
          {provider.displayName
            .trim()
            .split(' ')
            .slice(-2)
            .map((part) => part[0])
            .join('')}
        </div>
        <div className="profile-name">
          <p className="eyebrow">{provider.city || t.eyebrow}</p>
          <h1>{provider.displayName}</h1>
          <div className="profile-tags">
            {provider.genres.map((genre) => (
              <span className="card-tag" key={genre}>
                {t.genreLabels[genre]}
              </span>
            ))}
          </div>
        </div>
        {canRequest ? (
          <button className="button-link dark" onClick={onContact}>
            {t.profileUi.contact}
          </button>
        ) : null}
      </header>
      <div className="profile-content-layout">
        <div className="profile-main">
          <nav className="profile-tabs" aria-label={t.profileUi.publicProfile}>
            {(['works', 'about', 'services', 'reviews'] as const).map((key) => (
              <button
                key={key}
                className={tab === key ? 'active' : ''}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {t.profileUi[key]}
              </button>
            ))}
          </nav>
          {tab === 'works' ? (
            <section className="profile-section">
              <div className="row between">
                <h2>{t.provider.portfolios}</h2>
                <span className="muted">
                  {portfolios.length} {t.profileUi.albums.toLowerCase()}
                </span>
              </div>
              {portfolios.length ? (
                <div className="profile-album-grid">
                  {portfolios.map((portfolio) => (
                    <Link
                      key={portfolio.id}
                      className="profile-album"
                      to={`/portfolios/${portfolio.id}`}
                    >
                      {portfolio.coverUrl ? (
                        <img src={portfolio.coverUrl} alt={portfolio.title} loading="lazy" />
                      ) : (
                        <div className="profile-album-placeholder">
                          {portfolio.title.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <span className="eyebrow">
                          {t.genreLabels[portfolio.genre as keyof typeof t.genreLabels]}
                        </span>
                        <h3>{portfolio.title}</h3>
                        <p>{portfolio.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="profile-empty">{t.profileUi.noWork}</p>
              )}
            </section>
          ) : null}
          {tab === 'about' ? (
            <section className="profile-section">
              <h2>{t.profileUi.about}</h2>
              <p className="profile-biography">{provider.bio || t.profileUi.noBio}</p>
              <dl className="profile-facts">
                <div>
                  <dt>{t.profileUi.location}</dt>
                  <dd>{[provider.district, provider.city].filter(Boolean).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt>{t.profileUi.specialty}</dt>
                  <dd>{provider.genres.map((genre) => t.genreLabels[genre]).join(', ')}</dd>
                </div>
              </dl>
              {provider.styles.length ? (
                <div className="profile-tags">
                  {provider.styles.map((style) => (
                    <span key={style} className="card-tag">
                      {style}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
          {tab === 'services' ? (
            <section className="profile-section">
              <h2>{t.profileUi.services}</h2>
              {services.length ? (
                services.map((service) => (
                  <article key={service.id} className="profile-package">
                    <div>
                      <span className="eyebrow">{t.genreLabels[service.genre]}</span>
                      <h3>{service.name}</h3>
                      <p>{service.description}</p>
                      <div className="package-details">
                        <span>
                          {service.durationMinutes} {t.provider.minutes}
                        </span>
                        <span>
                          {service.photoCount} {t.provider.photos}
                        </span>
                        <span>
                          {service.retouchedCount} {t.provider.retouched}
                        </span>
                      </div>
                    </div>
                    <div className="package-price">
                      <strong>{currency(service.price)}</strong>
                      {canRequest ? (
                        <Action onClick={() => onBook(service)}>{t.provider.book}</Action>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="profile-empty">{t.profileUi.noServices}</p>
              )}
            </section>
          ) : null}
          {tab === 'reviews' ? (
            <section className="profile-section">
              <h2>{t.profileUi.reviews}</h2>
              {reviews.length ? (
                reviews.map((review) => (
                  <blockquote key={review.id} className="profile-review">
                    <span className="review-stars" aria-label={`${review.rating}/5`}>
                      {'★'.repeat(review.rating)}
                    </span>
                    <p>{review.comment}</p>
                    <cite>{review.authorName}</cite>
                    <DemoReportButton
                      targetType="review"
                      targetId={review.id}
                      title={review.comment}
                    />
                  </blockquote>
                ))
              ) : (
                <p className="profile-empty">{t.profileUi.noReviews}</p>
              )}
            </section>
          ) : null}
        </div>
        <aside className="profile-aside">
          <section className="profile-summary">
            <span className="eyebrow">{t.profileUi.about}</span>
            <p>{provider.bio || t.profileUi.noBio}</p>
            <dl>
              <div>
                <dt>{t.profileUi.albums}</dt>
                <dd>{portfolios.length}</dd>
              </div>
              <div>
                <dt>{t.profileUi.specialty}</dt>
                <dd>{provider.genres.length}</dd>
              </div>
              {provider.ratingAvg !== null ? (
                <div>
                  <dt>{t.profileUi.reviews}</dt>
                  <dd>
                    ★ {provider.ratingAvg.toFixed(1)} <small>({provider.reviewCount})</small>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section className="profile-inquiry">
            <p className="eyebrow">{t.profileUi.services}</p>
            <h3>{provider.priceFrom !== null ? currency(provider.priceFrom) : t.contactPrice}</h3>
            <p>{services.length ? services[0].name : t.profileUi.noServices}</p>
            {canRequest && services[0] ? (
              <Action onClick={() => onBook(services[0])}>{t.provider.book}</Action>
            ) : canRequest ? (
              <button className="button-link" onClick={onContact}>
                {t.profileUi.contact}
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
