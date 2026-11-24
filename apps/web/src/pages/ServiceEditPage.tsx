import { Link, useParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import { PageHeading, QueryState } from '../components/ui';
import { ServiceForm } from '../features/catalog/ProviderForms';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { AddOnEditor } from './StudioPage';

export function ServiceEditPage() {
  const t = useStrings();
  const { id = '' } = useParams();
  const services = useApi<Service[]>('/v1/me/services');
  const service = services.data?.find(
    (item) => item.id === id && item.ownerType === 'photographer',
  );
  return (
    <>
      <PageHeading
        title={t.studio.editService}
        subtitle={service?.name}
        action={
          <Link className="button-link" to="/portfolio">
            {t.back}
          </Link>
        }
      />
      {services.isPending || services.error ? <QueryState query={services} /> : null}
      {services.isSuccess && !service ? <p role="alert">{t.errors.not_found}</p> : null}
      {service ? (
        <div className="service-edit-layout">
          <section className="service-edit-panel">
            <h2>{t.studio.services}</h2>
            <ServiceForm key={service.id} initial={service} />
          </section>
          <section className="service-edit-panel">
            <h2>{t.studio.addOn}</h2>
            <AddOnEditor key={service.id} serviceId={service.id} />
          </section>
        </div>
      ) : null}
    </>
  );
}
