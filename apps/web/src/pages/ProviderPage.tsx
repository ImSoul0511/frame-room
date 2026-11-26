import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ProviderDetail } from '../lib/types';
import { useApi, useTask } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';
import { Feedback, QueryState } from '../components/ui';
import { ProviderProfile } from '../features/profiles/ProviderProfile';
import { useLanguage, useStrings } from '../lib/i18n';
import { openDirectChat } from '../features/messaging/inbox-data';
import { Availability, type AvailableSlot } from '../features/booking/Availability';
import type { OwnPhotographer, Service } from '@frameroom/shared';
import type { Studio } from '../lib/types';

export function ProviderPage() {
  const t = useStrings();
  const { language } = useLanguage();
  const client = useQueryClient();
  const auth = useAuth();
  const { type, id: identifier = '' } = useParams();
  const validType = type === 'studio' || type === 'photographer';
  const isUserName = type === 'photographer' && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identifier);
  const detail = useApi<ProviderDetail>(
    isUserName
      ? `/v1/photographers/by-username?userName=${encodeURIComponent(identifier)}`
      : `/v1/${type === 'studio' ? 'studios' : 'photographers'}/${encodeURIComponent(identifier)}`,
    validType,
  );
  const id = detail.data?.provider.id ?? '';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const publicIdentifier =
    type === 'photographer' ? (detail.data?.userName ?? identifier) : identifier;
  const providerPath = `/providers/${type}/${encodeURIComponent(publicIdentifier)}`;
  useEffect(() => {
    if (detail.data && identifier !== publicIdentifier) {
      navigate(`${providerPath}${params.size ? `?${params}` : ''}`, { replace: true });
    }
  }, [detail.data, identifier, publicIdentifier, providerPath, params, navigate]);
  const resumeStart = params.get('askStart');
  const resumeEnd = params.get('askEnd');
  const contactTask = useTask(async (slot?: Pick<AvailableSlot, 'start' | 'end'>) => {
    const conversation = await post<{ id: string }>('/v1/conversations', {
      providerType: type,
      providerId: id,
    });
    if (slot && auth.profile) {
      const key = ['message-draft', auth.profile.id, conversation.id];
      const dateTime = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const text = `${t.workspaceUi.slotInquiry} ${dateTime.format(new Date(slot.start))} – ${dateTime.format(new Date(slot.end))} (UTC+7)`;
      if (!client.getQueryData(key))
        client.setQueryData(key, {
          submissionId: crypto.randomUUID(),
          text,
          storagePath: null,
        });
    }
    openDirectChat(conversation.id);
    if (params.get('intent') === 'contact') navigate(providerPath, { replace: true });
  });
  const resumeContact = contactTask.mutate;
  const contactIntent = params.get('intent') === 'contact';
  const resumeKey = useRef('');
  useEffect(() => {
    if (
      !validType ||
      !id ||
      !auth.profile ||
      auth.onboardingRequired ||
      !contactIntent ||
      resumeKey.current === providerPath
    )
      return;
    resumeKey.current = providerPath;
    resumeContact(
      resumeStart &&
        resumeEnd &&
        Number.isFinite(Date.parse(resumeStart)) &&
        Number.isFinite(Date.parse(resumeEnd))
        ? { start: resumeStart, end: resumeEnd }
        : undefined,
    );
  }, [
    auth.onboardingRequired,
    auth.profile,
    contactIntent,
    providerPath,
    resumeContact,
    resumeStart,
    resumeEnd,
    validType,
    id,
  ]);
  const studios = useApi<Studio[]>('/v1/me/studios', Boolean(auth.profile && type === 'studio'));
  const photographer = useApi<OwnPhotographer | null>(
    '/v1/photographers/me',
    Boolean(auth.profile?.roles.includes('photographer') && type === 'photographer'),
  );
  const own =
    type === 'studio'
      ? studios.data?.some((studio) => studio.id === id && studio.role === 'manager')
      : photographer.data?.id === id;
  const ask = (slot?: AvailableSlot) => {
    if (!auth.session || auth.onboardingRequired) {
      const query = new URLSearchParams({ intent: 'contact' });
      if (slot) {
        query.set('askStart', slot.start);
        query.set('askEnd', slot.end);
      }
      navigate(`/auth?next=${encodeURIComponent(`${providerPath}?${query}`)}`);
    } else if (!contactTask.isPending) contactTask.mutate(slot);
  };
  const book = (service?: Service, slot?: AvailableSlot) => {
    const query = new URLSearchParams({ providerType: type ?? '', providerId: id });
    if (service) query.set('service', service.id);
    const project = params.get('project');
    if (project) query.set('project', project);
    if (slot) {
      query.set('start', new Date(Date.parse(slot.start) + 7 * 3600000).toISOString().slice(0, 16));
      query.set('end', new Date(Date.parse(slot.end) + 7 * 3600000).toISOString().slice(0, 16));
    }
    navigate(`/bookings/new?${query}`);
  };
  if (!validType) return <p>{t.notFound}</p>;
  if (!detail.data) return <QueryState query={detail} />;
  return (
    <>
      <Feedback error={contactTask.error} />
      <ProviderProfile
        key={id}
        detail={detail.data}
        canRequest={!own}
        onContact={ask}
        onBook={book}
        availability={
          own ? undefined : (
            <Availability
              type={type}
              id={id}
              onAsk={ask}
              onBook={
                detail.data.services.length
                  ? (slot) =>
                      book(
                        detail.data!.services.length === 1 ? detail.data!.services[0] : undefined,
                        slot,
                      )
                  : undefined
              }
            />
          )
        }
      />
    </>
  );
}
