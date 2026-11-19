import { useState } from 'react';
import { Action, Area, Feedback, Field, Form } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { canUseRoom } from './permissions';
import { ConversationThread } from './Conversations';
import type { DemoBooking } from './types';

export function DemoRoomPanel({ booking }: { booking: DemoBooking }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [title, setTitle] = useState('');
  const [decision, setDecision] = useState('');
  const writable = canUseRoom(demo.state, demo.role, booking);
  const conversation = demo.state.conversations.find(
    (value) =>
      value.client === booking.client &&
      value.provider === booking.provider &&
      value.providerType === booking.providerType,
  );
  return (
    <>
      <p className="workspace-hint">{writable ? t.demo.scopeHint : t.demo.roomClosed}</p>
      <div className="workspace-room-grid">
        <section className="workspace-card">
          <h2>{t.demo.messages}</h2>
          {conversation ? (
            <ConversationThread
              key={`${conversation.id}-${demo.role}`}
              conversationId={conversation.id}
              bookingId={booking.id}
            />
          ) : writable ? (
            <Action
              onClick={() =>
                task.execute({
                  type: 'conversation',
                  id: crypto.randomUUID(),
                  provider: booking.provider,
                  providerType: booking.providerType,
                  providerName: booking.providerName,
                  booking: booking.id,
                })
              }
            >
              {t.demo.contact}
            </Action>
          ) : (
            <p>{t.demo.noMessages}</p>
          )}
        </section>
        <aside>
          <section className="workspace-card">
            <h2>{t.demo.milestones}</h2>
            {booking.milestones.map((milestone) => (
              <label className="checkbox-row" key={milestone.id}>
                <input
                  type="checkbox"
                  checked={milestone.done}
                  disabled={!writable}
                  onChange={() =>
                    task.execute({
                      type: 'milestone-done',
                      id: booking.id,
                      milestone: milestone.id,
                    })
                  }
                />
                {demo.text(milestone.title)}
              </label>
            ))}
            {writable ? (
              <Form
                onSubmit={() => {
                  if (task.execute({ type: 'milestone', id: booking.id, title })) setTitle('');
                }}
              >
                <Field label={t.demo.milestone} value={title} onChange={setTitle} />
                <Action type="submit" disabled={!title.trim()}>
                  {t.create}
                </Action>
              </Form>
            ) : null}
          </section>
          <section className="workspace-card">
            <h2>{t.demo.decisions}</h2>
            {booking.decisions.map((value) => (
              <article className="workspace-decision" key={value.id}>
                <p>{value.text}</p>
                <span className="status">
                  {value.result === 'proposed'
                    ? t.demo.waiting
                    : value.result === 'agreed'
                      ? t.booking.agreed
                      : t.statuses.rejected}
                </span>
                {writable && value.by !== demo.role && value.result === 'proposed' ? (
                  <div className="row wrap">
                    <button
                      className="text-button"
                      onClick={() =>
                        task.execute({
                          type: 'decision-result',
                          id: booking.id,
                          decision: value.id,
                          result: 'agreed',
                        })
                      }
                    >
                      {t.booking.agree}
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        task.execute({
                          type: 'decision-result',
                          id: booking.id,
                          decision: value.id,
                          result: 'rejected',
                        })
                      }
                    >
                      {t.booking.reject}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {writable ? (
              <Form
                onSubmit={() => {
                  if (task.execute({ type: 'decision', id: booking.id, text: decision }))
                    setDecision('');
                }}
              >
                <Area label={t.demo.decision} value={decision} onChange={setDecision} />
                <Action type="submit" disabled={!decision.trim()}>
                  {t.create}
                </Action>
              </Form>
            ) : null}
          </section>
          <Feedback error={task.error} />
        </aside>
      </div>
    </>
  );
}
