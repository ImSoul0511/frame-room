import { useApi } from '../../lib/hooks';
import type { Conversation } from './types';

export type InboxSelection = { kind: 'direct' | 'project'; id?: string };
export const inboxUrl = ({ kind, id }: InboxSelection) => {
  if (kind === 'project')
    return id ? `/messages?room=${encodeURIComponent(id)}` : '/messages?tab=projects';
  return id ? `/messages?conversation=${encodeURIComponent(id)}` : '/messages';
};

export function useInbox(enabled: boolean) {
  const direct = useApi<Conversation[]>('/v1/conversations?scope=direct', enabled, 15000);
  const project = useApi<Conversation[]>('/v1/project-conversations', enabled, 15000);
  return { direct, project };
}

export function openDirectChat(id: string) {
  window.dispatchEvent(new CustomEvent('frameroom:open-chat', { detail: id }));
}
