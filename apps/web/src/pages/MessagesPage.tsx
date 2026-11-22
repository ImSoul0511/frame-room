import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  Action,
  Area,
  Feedback,
  FilePicker,
  Form,
  PageHeading,
  QueryState,
} from '../components/ui';
import { api, dateTime, post, supabase, upload } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { MessageAttachment } from '../features/booking/MessageAttachment';

type Conversation = {
  id: string;
  clientId: string;
  clientName: string;
  providerName: string;
  photographerId: string | null;
  studioId: string | null;
};
type Message = {
  id: string;
  senderId: string | null;
  senderName: string | null;
  bookingId: string | null;
  text: string;
  type: 'text' | 'image' | 'system';
  createdAt: string;
  storagePath: string | null;
};
type Messages = { items: Message[]; before: string | null };

export function MessagesPage() {
  const t = useStrings();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const list = useApi<Conversation[]>('/v1/conversations', true, 15000);
  const active = list.data?.find((entry) => entry.id === params.get('conversation'));
  if (!session) return null;
  return (
    <>
      <PageHeading title={t.workspaceUi.messages} />
      <QueryState query={list} empty={list.data?.length === 0} />
      <div className="two-col">
        <nav className="panel" aria-label={t.workspaceUi.messages}>
          {list.data?.map((item) => (
            <Link
              className="list-row"
              key={item.id}
              to={`?conversation=${item.id}`}
              aria-current={active?.id === item.id ? 'page' : undefined}
            >
              {item.clientId === session.user.id ? item.providerName : item.clientName}
            </Link>
          ))}
        </nav>
        {active ? (
          <ConversationThread key={active.id} conversation={active} userId={session.user.id} />
        ) : null}
      </div>
    </>
  );
}

function ConversationThread({
  conversation,
  userId,
}: {
  conversation: Conversation;
  userId: string;
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
  const send = useTask(async () => {
    await post(`/v1/conversations/${id}/messages`, { submissionId, text, storagePath: attachment });
    setText('');
    setAttachment(null);
    setSubmissionId(crypto.randomUUID());
    await client.invalidateQueries({ queryKey });
  });
  const file = useTask(async (image: File) => {
    const result = await upload(image, 'conversation-files', id);
    setAttachment(result.storagePath);
    setSubmissionId(crypto.randomUUID());
  });
  const isClient = conversation.clientId === userId;
  const provider = conversation.studioId
    ? `studio/${conversation.studioId}`
    : `photographer/${conversation.photographerId}`;
  const items = messages.data?.pages.flatMap((page) => page.items).reverse() ?? [];
  return (
    <section className="panel">
      <h2>{isClient ? conversation.providerName : conversation.clientName}</h2>
      {isClient ? <Link to={`/providers/${provider}`}>{t.discovery.viewProfile}</Link> : null}
      {!connected ? <p role="status">{t.discovery.messageUpdatesDelayed}</p> : null}
      <QueryState query={messages} empty={items.length === 0} />
      {messages.hasNextPage ? (
        <Action
          secondary
          pending={messages.isFetchingNextPage}
          onClick={() => void messages.fetchNextPage()}
        >
          {t.discovery.loadEarlierMessages}
        </Action>
      ) : null}
      <div className="room-messages" aria-live="polite">
        {items.map((message) => (
          <MessageRow key={message.id} message={message} own={message.senderId === userId} />
        ))}
      </div>
      <Form
        onSubmit={() => {
          if (!send.isPending && !file.isPending) send.mutate();
        }}
      >
        <fieldset disabled={send.isPending}>
          <Area
            label={t.booking.messages}
            value={text}
            onChange={(value) => {
              setText(value);
              setSubmissionId(crypto.randomUUID());
            }}
          />
          <FilePicker
            label={attachment ? t.explore.referenceReady : t.project.addReference}
            onFile={(image) => file.mutate(image)}
            disabled={file.isPending || send.isPending}
          />
          {attachment ? (
            <Action
              secondary
              onClick={() => {
                setAttachment(null);
                setSubmissionId(crypto.randomUUID());
              }}
            >
              {t.delete}
            </Action>
          ) : null}
        </fieldset>
        <Action
          type="submit"
          pending={send.isPending}
          disabled={file.isPending || (!text.trim() && !attachment)}
        >
          {t.booking.send}
        </Action>
      </Form>
      <Feedback error={send.error ?? file.error} />
    </section>
  );
}

function MessageRow({ message, own }: { message: Message; own: boolean }) {
  const t = useStrings();
  return (
    <article className={`room-message ${own ? 'mine' : ''}`}>
      <small>
        {message.senderName ? `${message.senderName} · ` : ''}
        {dateTime(message.createdAt)}
      </small>
      {message.bookingId ? (
        <Link to={`/bookings/${message.bookingId}`}>{t.booking.title}</Link>
      ) : null}
      <p>
        {message.type === 'system'
          ? (t.statuses[message.text as keyof typeof t.statuses] ?? message.text)
          : message.text}
      </p>
      {message.storagePath ? <MessageAttachment messageId={message.id} /> : null}
    </article>
  );
}
