import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  const contactPath = `/providers/${type}/${id}?intent=contact`;
  const contactTask = useTask(async () => {
    const conversation = await post<{ id: string }>('/v1/conversations', {
      providerType: type,
      providerId: id,
    });
    navigate(`/messages?conversation=${conversation.id}`);
  });
  const resumeContact = contactTask.mutate;
  const contactIntent = params.get('intent') === 'contact';
  const resumeKey = useRef('');
  useEffect(() => {
    if (
      !validType ||
      !auth.profile ||
      auth.onboardingRequired ||
      !contactIntent ||
      resumeKey.current === contactPath
    )
      return;
    resumeKey.current = contactPath;
    resumeContact();
  }, [auth.onboardingRequired, auth.profile, contactIntent, contactPath, resumeContact, validType]);
  const detail = useApi<ProviderDetail>(
    `/v1/${type === 'studio' ? 'studios' : 'photographers'}/${id}`,
    validType,
  );
  if (!validType) return <p>{t.notFound}</p>;
  if (!detail.data) return <QueryState query={detail} />;
  return (
    <>
      <Feedback error={contactTask.error} />
      <ProviderProfile
        key={id}
        detail={detail.data}
        onContact={() => {
          if (!auth.session || auth.onboardingRequired)
            navigate(`/auth?next=${encodeURIComponent(contactPath)}`);
          else if (!contactTask.isPending) contactTask.mutate();
        }}
        onBook={(service) => {
          const query = new URLSearchParams({
            providerType: type,
            providerId: id,
            service: service.id,
          });
          const project = params.get('project');
          if (project) query.set('project', project);
          navigate(`/bookings/new?${query}`);
        }}
      />
    </>
  );
}
