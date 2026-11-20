import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { ProviderDetail } from '../lib/types';
import { useApi, useTask } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';
import { Feedback, QueryState } from '../components/ui';
import { ProviderProfile } from '../features/profiles/ProviderProfile';
import { useStrings } from '../lib/i18n';
export function ProviderPage() {
  const t = useStrings();
  const auth = useAuth();
  const { type, id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const validType = type === 'studio' || type === 'photographer';
  const detail = useApi<ProviderDetail>(
    `/v1/${type === 'studio' ? 'studios' : 'photographers'}/${encodeURIComponent(id)}`,
    validType,
  );
  const provider = detail.data?.provider;
  const contactPath = `/providers/${type}/${encodeURIComponent(id)}?${new URLSearchParams({ intent: 'contact', ...(params.get('project') ? { project: params.get('project')! } : {}) })}`;
  const contact = useTask(async () => {
    if (!provider) return;
    const conversation = await post<{ id: string }>('/v1/conversations', {
      providerType: type,
      providerId: provider.id,
    });
    navigate(`/messages?conversation=${conversation.id}`);
  });
  const resumeContact = contact.mutate;
  const resumed = useRef('');
  useEffect(() => {
    if (
      !provider ||
      !auth.profile ||
      auth.onboardingRequired ||
      params.get('intent') !== 'contact' ||
      resumed.current === contactPath
    )
      return;
    resumed.current = contactPath;
    resumeContact();
  }, [provider, auth.profile, auth.onboardingRequired, params, contactPath, resumeContact]);
  if (!validType) return <p role="alert">{t.notFound}</p>;
  if (!detail.data || !provider) return <QueryState query={detail} />;
  const book = (service: Service) => {
    const destination = `/bookings/new?${new URLSearchParams({ providerType: type, providerId: provider.id, service: service.id, ...(params.get('project') ? { project: params.get('project')! } : {}) })}`;
    navigate(
      auth.session && !auth.onboardingRequired
        ? destination
        : `/auth?next=${encodeURIComponent(destination)}`,
    );
  };
  return (
    <>
      <Feedback error={contact.error} />
      <ProviderProfile
        detail={detail.data}
        onBook={book}
        onContact={() => {
          if (!auth.session || auth.onboardingRequired)
            navigate(`/auth?next=${encodeURIComponent(contactPath)}`);
          else if (!contact.isPending) contact.mutate();
        }}
      />
    </>
  );
}
