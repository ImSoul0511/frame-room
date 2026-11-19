import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { ProviderDetail } from '../lib/types';
import { useApi, useTask } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';
import { Action, Feedback, QueryState } from '../components/ui';
import { ProviderProfile } from '../features/profiles/ProviderProfile';
import { useStrings } from '../lib/i18n';
import { useDemo, useDemoTask } from '../features/demo/DemoContext';
import { getDemoProviderDetail } from '../features/demo/public-catalog';
import { createDemoService } from '../features/demo/seed';
import type { DemoOffer } from '../features/demo/types';

export function ProviderPage() {
  const t = useStrings();
  const demo = useDemo();
  const task = useDemoTask();
  const accountMode = demo.choice === 'account';
  const auth = useAuth();
  const { type, id = '' } = useParams();
  const [params] = useSearchParams();
  const validType = type === 'studio' || type === 'photographer';
  const local = accountMode ? null : getDemoProviderDetail(demo.state, id, demo.text, demo.image);
  const navigate = useNavigate();
  const contactPath = `/providers/${type}/${id}?intent=contact`;
  const liveContact = useTask(async () => {
    const conversation = await post<{ id: string }>('/v1/conversations', {
      providerType: type,
      providerId: id,
    });
    navigate(`/messages?conversation=${conversation.id}`);
  });
  const resumeContact = liveContact.mutate;
  const contactIntent = params.get('intent') === 'contact';
  const resumeKey = useRef('');
  useEffect(() => {
    if (!accountMode || !validType || !auth.profile || auth.onboardingRequired || !contactIntent)
      return;
    if (resumeKey.current === contactPath) return;
    resumeKey.current = contactPath;
    resumeContact();
  }, [
    accountMode,
    auth.onboardingRequired,
    auth.profile,
    contactIntent,
    contactPath,
    resumeContact,
    validType,
  ]);
  const detail = useApi<ProviderDetail>(
    `/v1/${type === 'studio' ? 'studios' : 'photographers'}/${id}`,
    validType && !local,
  );
  if (!validType || (local && local.provider.type !== type)) return <p>{t.notFound}</p>;
  const source = local ?? detail.data;
  if (!source) return <QueryState query={detail} />;
  const fallback = createDemoService(id, `demo-package-${id}`);
  const services: Service[] =
    accountMode || source.services.length
      ? source.services
      : [
          {
            id: fallback.id,
            ownerType: type,
            photographerId: type === 'photographer' ? id : null,
            studioId: type === 'studio' ? id : null,
            name: t.demo.demoPackage,
            description: demo.text(fallback.description),
            genre: fallback.genre,
            price: fallback.price,
            durationMinutes: fallback.duration,
            photoCount: fallback.photos,
            retouchedCount: fallback.retouched,
            isActive: true,
          },
        ];
  const offerFor = (service: Service): DemoOffer => ({
    provider: id,
    providerType: type,
    providerName: source.provider.displayName,
    service: demo.state.services.find((value) => value.id === service.id) ?? {
      id: service.id,
      owner: id,
      name: service.name,
      description: service.description,
      genre: service.genre,
      price: service.price,
      duration: service.durationMinutes,
      photos: service.photoCount,
      retouched: service.retouchedCount,
      quota: Math.max(1, service.retouchedCount),
      revisions: 2,
      published: service.isActive,
    },
  });
  const contact = () => {
    if (accountMode) {
      if (!auth.session || auth.onboardingRequired)
        navigate(`/auth?next=${encodeURIComponent(contactPath)}`);
      else if (!liveContact.isPending) liveContact.mutate();
      return;
    }
    const offer = offerFor(services[0]);
    demo.setOffer(offer);
    if (demo.role === 'guest') {
      demo.setRole('account');
      navigate(`/auth?next=${encodeURIComponent(`/providers/${type}/${id}?intent=contact`)}`);
      return;
    }
    if (demo.role !== 'client') return;
    const conversation = demo.state.conversations.find(
      (value) => value.client === 'client' && value.provider === id && value.providerType === type,
    );
    const conversationId = conversation?.id ?? crypto.randomUUID();
    if (
      task.execute({
        type: 'conversation',
        id: conversationId,
        provider: id,
        providerType: type,
        providerName: source.provider.displayName,
      })
    )
      navigate(`/messages?conversation=${conversationId}`);
  };
  return (
    <>
      {!accountMode ? <p className="workspace-hint">{t.demo.demoNote}</p> : null}
      <Feedback error={accountMode ? liveContact.error : task.error} />
      {(accountMode ? Boolean(auth.profile) : demo.role === 'client') && params.get('intent') ? (
        <section className="workspace-card">
          <Action
            pending={accountMode && contactIntent && liveContact.isPending}
            onClick={() => {
              if (params.get('intent') === 'contact') contact();
              else {
                if (accountMode) {
                  const service = services.find((value) => value.id === params.get('service'));
                  if (service)
                    navigate(
                      `/bookings/new?providerType=${type}&providerId=${id}&service=${service.id}`,
                    );
                  return;
                }
                const offer = offerFor(
                  services.find((value) => value.id === params.get('service')) ?? services[0],
                );
                demo.setOffer(offer);
                navigate('/bookings/new', { state: offer });
              }
            }}
          >
            {params.get('intent') === 'contact' ? t.demo.continueContact : t.demo.newBooking}
          </Action>
        </section>
      ) : null}
      <ProviderProfile
        key={source.provider.id}
        detail={{ ...source, services }}
        canRequest={accountMode || demo.role === 'guest' || demo.role === 'client'}
        onContact={contact}
        onBook={(service) => {
          if (accountMode) {
            const query = new URLSearchParams({
              providerType: type,
              providerId: id,
              service: service.id,
            });
            const project = params.get('project');
            if (project) query.set('project', project);
            navigate(`/bookings/new?${query}`);
            return;
          }
          const offer = offerFor(service);
          demo.setOffer(offer);
          if (demo.role === 'guest') {
            demo.setRole('account');
            navigate(
              `/auth?next=${encodeURIComponent(`/providers/${type}/${id}?intent=book&service=${service.id}`)}`,
            );
          } else if (demo.role === 'client') navigate('/bookings/new', { state: offer });
        }}
      />
    </>
  );
}
