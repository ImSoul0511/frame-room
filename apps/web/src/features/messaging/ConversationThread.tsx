import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserAvatar } from '../../components/UserAvatar';
import { api, post, supabase, upload } from '../../lib/api';
import { useTask } from '../../lib/hooks';
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
}: {
  conversation: Conversation;
  userId: string;
  currentUserName: string;
  currentUserAvatarPath?: string | null;
}) {
  const t = useStrings();
  const client = useQueryClient();
  const id = conversation.id;
  const queryKey = ['conversation', userId, id];
  const [connected, setConnected] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const messages = useInfiniteQuery({
    queryKey,
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      api<Messages>(`/v1/conversations/${id}/messages${pageParam ? `?before=${pageParam}` : ''}`, {
        signal,
      }),
    getNextPageParam: (page) => page.before ?? undefined,
    refetchInterval: connected ? false : 5000,
  });

  useEffect(() => {
    if (!supabase) return;
    const refresh = () => void client.invalidateQueries({ queryKey: ['conversation', userId, id] });
    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'room_messages',
          event: 'INSERT',
          filter: `conversation_id=eq.${id}`,
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
  }, [client, id, userId]);

  const send = useTask(
    async (draft: { submissionId: string; text: string; storagePath: string | null }) => {
      await post(`/v1/conversations/${id}/messages`, draft);
      setText('');
      setAttachment(null);
      setSubmissionId(crypto.randomUUID());
      await client.invalidateQueries({ queryKey });
    },
  );
  const file = useTask(async (image: File) => {
    const result = await upload(image, 'conversation-files', id);
    setAttachment(result.storagePath);
    setSubmissionId(crypto.randomUUID());
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
        <Link
          className="messenger-back"
          to="/messages"
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
        </Link>
        <UserAvatar
          name={peerName}
          avatarPath={peerAvatarPath}
          className="messenger-avatar messenger-avatar-large"
        />
        <div className="messenger-thread-heading">
          <h2>{peerName}</h2>
          {isClient ? (
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

      <MessageComposer
        text={text}
        attachment={attachment}
        isSending={send.isPending}
        isUploading={file.isPending}
        error={(confirmed ? null : send.error) ?? file.error}
        onTextChange={(value) => {
          setText(value);
          setSubmissionId(crypto.randomUUID());
        }}
        onRemoveAttachment={() => {
          setAttachment(null);
          setSubmissionId(crypto.randomUUID());
        }}
        onFile={(image) => file.mutate(image)}
        onSubmit={() => {
          if (!send.isPending && !file.isPending && (text.trim() || attachment))
            send.mutate({ submissionId, text, storagePath: attachment });
        }}
      />
    </section>
  );
}
