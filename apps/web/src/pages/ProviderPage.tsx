import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { ProviderDetail } from '../lib/types';
import { useApi } from '../lib/hooks';
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
  const { type, id = '' } = useParams();
  const [params] = useSearchParams();
  const validType = type === 'studio' || type === 'photographer';
  const local = getDemoProviderDetail(demo.state, id, demo.text, demo.image);
  const detail = useApi<ProviderDetail>(
    `/v1/${type === 'studio' ? 'studios' : 'photographers'}/${id}`,
    validType && !local,
  );
  const navigate = useNavigate();
  if (!validType || (local && local.provider.type !== type)) return <p>{t.notFound}</p>;
  const source = local ?? detail.data;
  if (!source) return <QueryState query={detail} />;
  const fallback = createDemoService(id, `demo-package-${id}`);
  const services: Service[] = source.services.length
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
      <p className="workspace-hint">{t.demo.demoNote}</p>
      <Feedback error={task.error} />
      {demo.role === 'client' && params.get('intent') ? (
        <section className="workspace-card">
          <Action
            onClick={() => {
              if (params.get('intent') === 'contact') contact();
              else {
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
        canRequest={demo.role === 'guest' || demo.role === 'client'}
        onContact={contact}
        onBook={(service) => {
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
