import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { ProviderDetail } from '../lib/types';
import { useApi } from '../lib/hooks';
import { currency } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Action, Modal, PageHeading, QueryState } from '../components/ui';
import { BookingForm } from '../features/booking/BookingForm';
import { useStrings } from '../lib/i18n';

export function ProviderPage() {
  const t = useStrings();

  const { type, id } = useParams();
  const detail = useApi<ProviderDetail>(
    `/v1/${type === 'studio' ? 'studios' : 'photographers'}/${id}`,
  );
  const [service, setService] = useState<Service | null>(null);
  const { session } = useAuth();
  const navigate = useNavigate();
  if (!detail.data) return <QueryState query={detail} />;
  const { provider, services, portfolios, reviews } = detail.data;
  return (
    <>
      <PageHeading
        title={provider.displayName}
        subtitle={`${provider.city} · ${provider.genres.map((g) => t.genreLabels[g]).join(', ')}`}
      />
      <div className="provider-detail">
        <section>
          <h2>{t.provider.about}</h2>
          <p className="long-copy">{provider.bio}</p>
          <div className="section-header">
            <h2>{t.provider.portfolios}</h2>
            <span>{portfolios.length}</span>
          </div>
          <div className="portfolio-grid">
            {portfolios.map((p) => (
              <Link className="portfolio-tile" key={p.id} to={`/portfolios/${p.id}`}>
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt={p.title} />
                ) : (
                  <div className="art-placeholder">{p.title.slice(0, 1)}</div>
                )}
                <h3>{p.title}</h3>
              </Link>
            ))}
          </div>
          <h2>{t.provider.reviews}</h2>
          {reviews.length ? (
            reviews.map((r) => (
              <blockquote className="review" key={r.id}>
                <span>{'★'.repeat(r.rating)}</span>
                <p>{r.comment}</p>
                <cite>{r.authorName}</cite>
              </blockquote>
            ))
          ) : (
            <p className="muted">{t.empty}</p>
          )}
        </section>
        <aside className="service-sidebar">
          <h2>{t.provider.services}</h2>
          {services.map((s) => (
            <article className="service-card" key={s.id}>
              <span className="eyebrow">{t.genreLabels[s.genre]}</span>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <p className="muted">
                {s.durationMinutes} {t.provider.minutes} · {s.photoCount} {t.provider.photos} ·{' '}
                {s.retouchedCount} {t.provider.retouched}
              </p>
              <strong className="service-price">{currency(s.price)}</strong>
              <Action
                onClick={() =>
                  session
                    ? setService(s)
                    : navigate(`/auth?next=${encodeURIComponent(location.pathname)}`)
                }
              >
                {t.provider.book}
              </Action>
            </article>
          ))}
          {!services.length ? <p>{t.provider.empty}</p> : null}
        </aside>
      </div>
      {service ? (
        <Modal title={`${t.booking.new} · ${service.name}`} onClose={() => setService(null)}>
          <BookingForm service={service} />
        </Modal>
      ) : null}
    </>
  );
}
