import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Action, Area, Feedback, Form, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { dateTime } from '../../lib/api';
import {
  canReadBooking,
  canReadConversation,
  canReadMessage,
  canUseRoom,
  ownsProvider,
} from './permissions';
import { useDemo, useDemoTask } from './DemoContext';
import type { DemoFile } from './types';

export function ConversationThread({
  conversationId,
  bookingId,
}: {
  conversationId: string;
  bookingId?: string;
}) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [context, setContext] = useState('general');
  const [text, setText] = useState('');
  const [file, setFile] = useState<DemoFile | undefined>();
  const conversation = demo.state.conversations.find((value) => value.id === conversationId);
  if (!conversation || !canReadConversation(demo.state, demo.role, conversation))
    return <p className="workspace-empty">{t.demo.forbidden}</p>;
  const general =
    demo.role === conversation.client || ownsProvider(demo.state, demo.role, conversation.provider);
  const bookings = demo.state.bookings.filter(
    (booking) =>
      booking.client === conversation.client &&
      booking.provider === conversation.provider &&
      booking.roomId &&
      canReadBooking(demo.state, demo.role, booking),
  );
  const current = bookingId ?? (context === 'general' && !general ? bookings[0]?.id : context);
  const booking = demo.state.bookings.find((value) => value.id === current);
  const write =
    current === 'general'
      ? general
      : Boolean(booking && canUseRoom(demo.state, demo.role, booking));
  const messages = demo.state.messages.filter(
    (message) =>
      message.conversation === conversation.id &&
      canReadMessage(demo.state, demo.role, conversation, message.booking) &&
      message.booking === (current === 'general' ? null : current),
  );
  return (
    <div className="workspace-thread">
      {!bookingId ? (
        <Select label={t.demo.context} value={current ?? ''} onChange={setContext}>
          {general ? <option value="general">{t.demo.general}</option> : null}
          {bookings.map((value) => (
            <option key={value.id} value={value.id}>
              {demo.text(value.service.name)} · {value.id.replace('demo-booking-', '#')}
            </option>
          ))}
        </Select>
      ) : null}
      {!general ? <p className="workspace-hint">{t.demo.assignedOnly}</p> : null}
      <div className="workspace-chat-messages" aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={message.sender === demo.role ? 'workspace-message own' : 'workspace-message'}
          >
            <header>
              <strong>
                {demo.text(demo.state.profiles[message.sender]?.name ?? message.sender)}
              </strong>
              <small>{dateTime(new Date(message.at).toISOString())}</small>
            </header>
            {message.text ? <p>{demo.text(message.text)}</p> : null}
            {message.file ? (
              <a href={message.file.url} download={message.file.name}>
                {message.file.mime.startsWith('image/') ? (
                  <img src={message.file.url} alt={message.file.name} />
                ) : (
                  message.file.name
                )}
              </a>
            ) : null}
          </article>
        ))}
        {!messages.length ? <p className="empty-state">{t.demo.noMessages}</p> : null}
      </div>
      {write ? (
        <Form
          onSubmit={() => {
            if (
              task.execute({
                type: 'message',
                id: crypto.randomUUID(),
                conversation: conversation.id,
                booking: current === 'general' ? null : current!,
                text,
                file,
                submission: crypto.randomUUID(),
              })
            ) {
              setText('');
              setFile(undefined);
            }
          }}
        >
          <Area label={t.demo.message} value={text} onChange={setText} />
          <div className="row between wrap">
            <label className="workspace-file-button">
              {t.demo.attach}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,application/zip"
                onChange={(event) => {
                  const source = event.target.files?.[0];
                  if (source) task.attempt(() => setFile(demo.file(source)));
                  event.target.value = '';
                }}
              />
            </label>
            <Action type="submit" disabled={!text.trim() && !file}>
              {t.demo.send}
            </Action>
          </div>
          {file ? (
            <div className="row">
              <span className="muted">{file.name}</span>
              <button type="button" className="text-button" onClick={() => setFile(undefined)}>
                {t.delete}
              </button>
            </div>
          ) : null}
          <Feedback error={task.error} />
        </Form>
      ) : (
        <p className="workspace-hint">{t.demo.roomClosed}</p>
      )}
    </div>
  );
}
export function WorkspaceMessagesPage() {
  const demo = useDemo();
  const t = useStrings();
  const [params] = useSearchParams();
  const task = useDemoTask();
  const navigate = useNavigate();
  const pending =
    demo.role === 'client' && demo.offer?.provider === params.get('contact') ? demo.offer : null;
  const list = demo.state.conversations.filter((conversation) =>
    canReadConversation(demo.state, demo.role, conversation),
  );
  const selected =
    list.find((conversation) => conversation.id === params.get('conversation')) ?? list[0];
  const offerService = selected
    ? (demo.state.services.find((value) => value.owner === selected.provider && value.published) ??
      (demo.offer?.provider === selected.provider ? demo.offer.service : undefined))
    : undefined;
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{t.demo.demo}</p>
          <h1>{t.demo.messages}</h1>
        </div>
        <Link className="button-link" to="/explore">
          {t.demo.newConversation}
        </Link>
      </header>
      {pending ? (
        <section className="workspace-card">
          <h2>{demo.text(pending.providerName)}</h2>
          <Action
            onClick={() => {
              const existing = list.find(
                (value) =>
                  value.provider === pending.provider &&
                  value.providerType === pending.providerType,
              );
              const id = existing?.id ?? crypto.randomUUID();
              if (
                task.execute({
                  type: 'conversation',
                  id,
                  provider: pending.provider,
                  providerType: pending.providerType,
                  providerName: pending.providerName,
                })
              )
                navigate(`/messages?conversation=${id}`);
            }}
          >
            {t.demo.continueContact}
          </Action>
          <Feedback error={task.error} />
        </section>
      ) : null}
      <div className="workspace-inbox">
        <nav aria-label={t.demo.messages}>
          {list.map((conversation) => (
            <Link
              key={conversation.id}
              to={`/messages?conversation=${encodeURIComponent(conversation.id)}`}
              className={selected?.id === conversation.id ? 'active' : ''}
            >
              <span className="workspace-avatar">
                {demo.text(conversation.providerName).slice(0, 1)}
              </span>
              <div>
                <strong>{demo.text(conversation.providerName)}</strong>
                <small>{t.demo.conversation}</small>
              </div>
            </Link>
          ))}
          {!list.length ? <p className="empty-state">{t.demo.noMessages}</p> : null}
        </nav>
        <section>
          {selected ? (
            <>
              <div className="row between wrap">
                <h2>{demo.text(selected.providerName)}</h2>
                {demo.role === 'client' ? (
                  <Link
                    className="button-link"
                    to={
                      offerService
                        ? '/bookings/new'
                        : `/providers/${selected.providerType}/${selected.provider}`
                    }
                    state={
                      offerService
                        ? {
                            provider: selected.provider,
                            providerType: selected.providerType,
                            providerName: selected.providerName,
                            service: offerService,
                          }
                        : undefined
                    }
                  >
                    {t.demo.useBrief}
                  </Link>
                ) : null}
              </div>
              <ConversationThread
                key={`${selected.id}-${demo.role}`}
                conversationId={selected.id}
              />
            </>
          ) : (
            <p className="empty-state">{t.demo.noMessages}</p>
          )}
        </section>
      </div>
    </>
  );
}
