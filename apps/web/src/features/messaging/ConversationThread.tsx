import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { PrivateQuote } from '@frameroom/shared';
import { Action, Modal, QueryState } from '../../components/ui';
import { ServiceForm } from '../catalog/ProviderForms';
import { UserAvatar } from '../../components/UserAvatar';
import { api, currency, post, RequestError, supabase, upload } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { ConversationHistory } from './ConversationHistory';
import { MessageComposer } from './MessageComposer';
import { markConversationSeen } from './readState';
import type { Conversation, Message, Messages } from './types';

export function ConversationThread({
  conversation,
  userId,
  currentUserName,
  currentUserAvatarPath,
  onBack,
}: {
  conversation: Conversation;
  userId: string;
  currentUserName: string;
  currentUserAvatarPath?: string | null;
  onBack: () => void;
}) {
  const t = useStrings();
  const client = useQueryClient();
  const id = conversation.id;
  const isRoom = Boolean(conversation.bookingId);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const quotePath = `/v1/conversations/${id}/quotes`;
  const quotes = useApi<PrivateQuote[]>(quotePath, !isRoom, 10000);
  const queryKey = ['conversation', userId, isRoom ? 'room' : 'direct', id];
  const draftKey = ['message-draft', userId, id];
  const [connected, setConnected] = useState(false);
  const emptyDraft = () => ({
    submissionId: crypto.randomUUID(),
    text: '',
    storagePath: null as string | null,
  });
  const { data: draft } = useQuery({
    queryKey: draftKey,
    queryFn: emptyDraft,
    initialData: emptyDraft,
    enabled: false,
  });
  const { text, storagePath: attachment, submissionId } = draft;
  const updateDraft = (change: Partial<typeof draft>) => {
    client.setQueryData(draftKey, (previous: typeof draft | undefined) => ({
      ...(previous ?? emptyDraft()),
      ...change,
      submissionId: crypto.randomUUID(),
    }));
  };
  const path = `/v1/${isRoom ? 'shoot-rooms' : 'conversations'}/${id}/messages`;
  const messages = useInfiniteQuery({
    queryKey,
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams();
      if (!isRoom) params.set('scope', 'direct');
      if (pageParam) params.set('before', pageParam);
      return api<Messages>(`${path}?${params}`, { signal });
    },
    getNextPageParam: (page) => page.before ?? undefined,
    refetchInterval: (query) =>
      connected ||
      (query.state.error instanceof RequestError &&
        query.state.error.reason === 'network_unavailable')
        ? false
        : 5000,
  });

  useEffect(() => {
    if (!supabase) return;
    const refresh = () =>
      void client.invalidateQueries({
        queryKey: ['conversation', userId, isRoom ? 'room' : 'direct', id],
      });
    const channel = supabase
      .channel(`inbox:${id}`)
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'room_messages',
          event: 'INSERT',
          filter: `${isRoom ? 'room_id' : 'conversation_id'}=eq.${id}`,
        },
        refresh,
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [client, id, isRoom, userId]);

  const send = useTask(
    async (draft: { submissionId: string; text: string; storagePath: string | null }) => {
      const payload = isRoom ? { text: draft.text, storagePath: draft.storagePath } : draft;
      await post(path, payload, draft.submissionId);
      client.setQueryData(draftKey, (current: typeof draft | undefined) =>
        current?.submissionId === draft.submissionId ? emptyDraft() : current,
      );
      await client.invalidateQueries({ queryKey });
    },
  );
  const file = useTask(async (image: File) => {
    const result = await upload(image, isRoom ? 'room-files' : 'conversation-files', id);
    updateDraft({ storagePath: result.storagePath });
  });
  const isClient = conversation.clientId === userId;
  const peerName = isClient ? conversation.providerName : conversation.clientName;
  const peerAvatarPath = isClient ? conversation.providerAvatarPath : conversation.clientAvatarPath;
  const provider = conversation.studioId
    ? `studio/${conversation.studioId}`
    : `photographer/${conversation.photographerId}`;
  const items = messages.data?.pages.flatMap((page) => page.items).reverse() ?? [];
  const latestIncoming = conversation.latestIncomingMessageId;
  const latestIsLoaded = Boolean(
    latestIncoming && items.some((item) => item.id === latestIncoming),
  );
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState === 'visible' && latestIncoming && latestIsLoaded)
        markConversationSeen(userId, id, latestIncoming);
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [id, latestIncoming, latestIsLoaded, userId]);
  const confirmed = Boolean(
    send.variables &&
    items.some((message) => message.submissionId === send.variables?.submissionId),
  );
  const pendingDraft =
    (send.isPending || send.isError) &&
    send.variables &&
    (send.isPending || send.variables.submissionId === submissionId) &&
    !items.some((message) => message.submissionId === send.variables?.submissionId)
      ? send.variables
      : null;
  const pendingMessage: Message | null = pendingDraft
    ? {
        id: pendingDraft.submissionId,
        senderId: userId,
        senderName: currentUserName,
        senderAvatarPath: currentUserAvatarPath,
        bookingId: null,
        text: pendingDraft.text,
        type: pendingDraft.storagePath ? 'image' : 'text',
        createdAt: new Date().toISOString(),
        storagePath: pendingDraft.storagePath,
        submissionId: pendingDraft.submissionId,
      }
    : null;
  return (
    <section className="messenger-thread" aria-label={`${t.workspaceUi.messages}: ${peerName}`}>
      <header className="messenger-thread-header">
        <button
          type="button"
          className="messenger-back"
          onClick={onBack}
          aria-label={t.messaging.backToConversations}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 12H5m0 0 7-7m-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <UserAvatar
          name={peerName}
          avatarPath={peerAvatarPath}
          className="messenger-avatar messenger-avatar-large"
        />
        <div className="messenger-thread-heading">
          <h2>{conversation.projectTitle ?? peerName}</h2>
          {isRoom ? (
            <Link className="messenger-profile-link" to={`/bookings/${conversation.bookingId}`}>
              {peerName} · {t.booking.title}
            </Link>
          ) : isClient ? (
            <Link className="messenger-profile-link" to={`/providers/${provider}`}>
              {t.discovery.viewProfile}
            </Link>
          ) : null}
        </div>
        <span className={`messenger-connection ${connected ? 'is-connected' : ''}`} role="status">
          <span aria-hidden="true" />
          {connected ? t.messaging.liveUpdates : t.discovery.messageUpdatesDelayed}
        </span>
      </header>
      {!isRoom && (
        <details className="messenger-quote-panel" open={quotes.data?.length ? true : undefined}>
          <summary>{t.workspaceUi.quote}</summary>
          <QueryState query={quotes} />
          {quotes.data?.map((quote, index) => (
            <div key={quote.id} className="row between wrap">
              <p>
                <strong>{quote.terms.name}</strong> · {quote.terms.quantity} ×{' '}
                {currency(quote.terms.price)}
              </p>
              {quote.bookingId ? (
                <Link to={`/bookings/${quote.bookingId}`}>{t.booking.title}</Link>
              ) : index === 0 && isClient ? (
                <Link to={`/bookings/new?conversation=${id}&quote=${quote.id}`}>
                  {t.workspaceUi.bookQuote}
                </Link>
              ) : index > 0 ? (
                <span className="muted">{t.workspaceUi.previousQuotes}</span>
              ) : null}
            </div>
          ))}
          {!isClient && (
            <Action secondary onClick={() => setShowQuoteForm(true)}>
              {t.workspaceUi.quote}
            </Action>
          )}
          {isClient && !quotes.data?.length && (
            <Link
              to={`/bookings/new?${new URLSearchParams({
                providerType: conversation.studioId ? 'studio' : 'photographer',
                providerId: conversation.studioId ?? conversation.photographerId ?? '',
              })}`}
            >
              {t.workspaceUi.bookQuote}
            </Link>
          )}
        </details>
      )}
      {showQuoteForm && (
        <Modal title={t.workspaceUi.quote} onClose={() => setShowQuoteForm(false)}>
          <ServiceForm
            onQuote={async (terms) => {
              await post(quotePath, terms);
              await quotes.refetch();
              setShowQuoteForm(false);
            }}
          />
        </Modal>
      )}

      <ConversationHistory
        query={messages}
        items={items}
        pendingMessage={pendingMessage}
        pendingStatus={send.isError ? t.messaging.sendFailed : t.messaging.sending}
        userId={userId}
        currentUserName={currentUserName}
        peerName={peerName}
        providerName={conversation.providerName}
        providerAvatarPath={conversation.providerAvatarPath}
        isClient={isClient}
        onLoadEarlier={() => void messages.fetchNextPage()}
      />

      {conversation.roomStatus === 'closed' ? (
        <p className="inbox-room-closed">{t.booking.closed}</p>
      ) : (
        <MessageComposer
          text={text}
          attachment={attachment}
          isSending={send.isPending}
          isUploading={file.isPending}
          error={(confirmed ? null : send.error) ?? file.error}
          onTextChange={(value) => updateDraft({ text: value })}
          onRemoveAttachment={() => updateDraft({ storagePath: null })}
          onFile={(image) => file.mutate(image)}
          onSubmit={() => {
            if (!send.isPending && !file.isPending && (text.trim() || attachment))
              send.mutate({ submissionId, text, storagePath: attachment });
          }}
        />
      )}
    </section>
  );
}
