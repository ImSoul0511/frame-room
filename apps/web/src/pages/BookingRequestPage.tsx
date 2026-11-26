import { Link, useSearchParams } from 'react-router-dom';
import { idSchema, type CreativeProject, type PrivateQuote } from '@frameroom/shared';
import { PageHeading, QueryState } from '../components/ui';
import { BookingForm } from '../features/booking/BookingForm';
import { useApi } from '../lib/hooks';
import { currency } from '../lib/api';
import { useStrings } from '../lib/i18n';
import type { ProviderDetail } from '../lib/types';

export function BookingRequestPage() {
  const t = useStrings();
  const [params] = useSearchParams();
  const providerType = params.get('providerType');
  const providerId = params.get('providerId');
  const valid =
    (providerType === 'photographer' || providerType === 'studio') &&
    idSchema.safeParse(providerId).success;
  const provider = useApi<ProviderDetail>(
    `/v1/${providerType === 'studio' ? 'studios' : 'photographers'}/${providerId}`,
    valid,
  );
  const projectId = params.get('project');
  const validProject = idSchema.safeParse(projectId).success;
  const project = useApi<CreativeProject>(`/v1/creative-projects/${projectId}`, validProject);
  const conversationId = params.get('conversation');
  const quoteId = params.get('quote');
  const isQuote = idSchema.safeParse(conversationId).success && idSchema.safeParse(quoteId).success;
  const quotes = useApi<PrivateQuote[]>(`/v1/conversations/${conversationId}/quotes`, isQuote);
  if (isQuote) {
    if (!quotes.data) return <QueryState query={quotes} />;
    const quote = quotes.data[0];
    if (quote?.id !== quoteId || quote.bookingId) return <p role="alert">{t.errors.not_found}</p>;
    return (
      <div className="narrow-page">
        <PageHeading title={t.workspaceUi.newBooking} subtitle={quote.terms.name} />
        <BookingForm key={quote.id} service={quote.terms} quote={quote} />
      </div>
    );
  }
  if (!valid) return <p role="alert">{t.errors.not_found}</p>;
  if (!provider.data) return <QueryState query={provider} />;
  if (validProject && !project.data) return <QueryState query={project} />;
  const service = provider.data.services.find((entry) => entry.id === params.get('service'));
  if (!service && !params.has('service'))
    return (
      <div className="narrow-page">
        <PageHeading
          title={t.workspaceUi.newBooking}
          subtitle={provider.data.provider.displayName}
        />
        <section className="profile-section">
          <h2>{t.profileUi.services}</h2>
          {provider.data.services.length === 0 && <p>{t.profileUi.noServices}</p>}
          {provider.data.services.map((item) => {
            const next = new URLSearchParams(params);
            next.set('service', item.id);
            return (
              <Link className="list-row" key={item.id} to={`/bookings/new?${next}`}>
                <span>{item.name}</span>
                <strong>
                  {currency(item.price)} / {t.workspaceUi[`unit_${item.billingUnit ?? 'package'}`]}
                </strong>
              </Link>
            );
          })}
        </section>
      </div>
    );
  if (!service) return <p role="alert">{t.errors.not_found}</p>;
  return (
    <div className="narrow-page">
      <PageHeading
        title={t.workspaceUi.newBooking}
        subtitle={`${provider.data.provider.displayName} · ${service.name}`}
      />
      <BookingForm
        key={`${service.id}:${project.data?.id ?? ''}`}
        service={service}
        project={project.data}
        slot={
          params.has('start') && params.has('end')
            ? { start: params.get('start')!, end: params.get('end')! }
            : undefined
        }
      />
    </div>
  );
}
