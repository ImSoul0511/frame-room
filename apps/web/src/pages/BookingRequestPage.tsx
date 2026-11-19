import { useSearchParams } from 'react-router-dom';
import { idSchema, type CreativeProject } from '@frameroom/shared';
import { PageHeading, QueryState } from '../components/ui';
import { BookingForm } from '../features/booking/BookingForm';
import { useApi } from '../lib/hooks';
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
  if (!valid) return <p role="alert">{t.errors.not_found}</p>;
  if (!provider.data) return <QueryState query={provider} />;
  if (validProject && !project.data) return <QueryState query={project} />;
  const service = provider.data.services.find((entry) => entry.id === params.get('service'));
  if (!service) return <p role="alert">{t.errors.not_found}</p>;
  return (
    <div className="narrow-page">
      <PageHeading
        title={t.demo.newBooking}
        subtitle={`${provider.data.provider.displayName} · ${service.name}`}
      />
      <BookingForm
        key={`${service.id}:${project.data?.id ?? ''}`}
        service={service}
        project={project.data}
      />
    </div>
  );
}
