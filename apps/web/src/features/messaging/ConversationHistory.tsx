import { useLayoutEffect, useRef } from 'react';
import { Action, QueryState } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { MessageBubble } from './MessageBubble';
import type { Message } from './types';

type HistoryQuery = {
  isPending: boolean;
  error: Error | null;
  refetch: () => unknown;
  dataUpdatedAt: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

export function ConversationHistory({
  query,
  items,
  pendingMessage,
  pendingStatus,
  userId,
  currentUserName,
  peerName,
  providerName,
  providerAvatarPath,
  isClient,
  onLoadEarlier,
}: {
  query: HistoryQuery;
  items: Message[];
  pendingMessage: Message | null;
  pendingStatus: string;
  userId: string;
  currentUserName: string;
  peerName: string;
  providerName: string;
  providerAvatarPath?: string | null;
  isClient: boolean;
  onLoadEarlier: () => void;
}) {
  const t = useStrings();
  const historyRef = useRef<HTMLDivElement>(null);
  const previousScroll = useRef<{ height: number; top: number } | null>(null);
  const followLatest = useRef(true);
  const hasPendingMessage = Boolean(pendingMessage);
  const loadEarlier = () => {
    const history = historyRef.current;
    if (history) previousScroll.current = { height: history.scrollHeight, top: history.scrollTop };
    onLoadEarlier();
  };

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history || query.isPending || query.isFetchingNextPage) return;
    if (query.error) {
      previousScroll.current = null;
      return;
    }
    const previous = previousScroll.current;
    if (previous) {
      history.scrollTop = previous.top + history.scrollHeight - previous.height;
    } else if (followLatest.current || hasPendingMessage) {
      history.scrollTop = history.scrollHeight;
    }
    previousScroll.current = null;
  }, [
    items.length,
    query.dataUpdatedAt,
    query.error,
    query.isFetchingNextPage,
    query.isPending,
    hasPendingMessage,
    pendingMessage?.id,
  ]);

  return (
    <div
      ref={historyRef}
      className="messenger-history"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      onScroll={(event) => {
        const history = event.currentTarget;
        followLatest.current =
          history.scrollHeight - history.scrollTop - history.clientHeight < 100;
      }}
    >
      {query.hasNextPage ? (
        <Action secondary pending={query.isFetchingNextPage} onClick={loadEarlier}>
          {t.discovery.loadEarlierMessages}
        </Action>
      ) : null}
      {query.isPending || query.error ? <QueryState query={query} /> : null}
      {items.length === 0 && !query.isPending && !query.error && !pendingMessage ? (
        <p className="messenger-empty-history">{t.messaging.emptyConversation}</p>
      ) : null}
      {items.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          avatarPath={
            message.type === 'system' && message.bookingId
              ? providerAvatarPath
              : message.senderAvatarPath
          }
          isOwn={
            message.type === 'system' && message.bookingId ? !isClient : message.senderId === userId
          }
          name={
            message.type === 'system' && message.bookingId
              ? providerName
              : (message.senderName ?? (message.senderId === userId ? currentUserName : peerName))
          }
        />
      ))}
      {pendingMessage ? (
        <MessageBubble
          key={pendingMessage.id}
          message={pendingMessage}
          avatarPath={pendingMessage.senderAvatarPath}
          isOwn
          name={currentUserName}
          pendingStatus={pendingStatus}
        />
      ) : null}
    </div>
  );
}
