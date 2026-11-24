import { useSyncExternalStore } from 'react';

let revision = 0;
const listeners = new Set<() => void>();
const keyFor = (userId: string) => `frameroom:messages-read:${userId}`;
const emit = () => {
  revision += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('frameroom:messages-read:')) emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};
function read(userId: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, id]) => typeof id === 'string'));
  } catch {
    return {};
  }
}
export function markConversationSeen(userId: string, conversationId: string, messageId: string) {
  const current = read(userId);
  if (current[conversationId] === messageId) return;
  try {
    localStorage.setItem(
      keyFor(userId),
      JSON.stringify({ ...current, [conversationId]: messageId }),
    );
    emit();
  } catch {
    // A browser may block local storage; leave the unread marker visible.
  }
}
export function useMessageReadState(userId: string | undefined) {
  useSyncExternalStore(
    subscribe,
    () => revision,
    () => 0,
  );
  return userId ? read(userId) : {};
}
