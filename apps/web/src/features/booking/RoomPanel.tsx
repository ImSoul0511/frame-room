import { useState } from 'react';
import type { Workspace } from '../../lib/types';
import { post, patch, upload, dateTime } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Area, DateField, Feedback, Field, FilePicker, Form } from '../../components/ui';

export function RoomPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [decision, setDecision] = useState('');
  const room = w.room!;
  const closed = room.status === 'closed';
  const send = useTask(async () => {
    await post(`/v1/shoot-rooms/${room.id}/messages`, { text, storagePath: attachment });
    setText('');
    setAttachment(null);
  });
  const file = useTask(async (image: File) => {
    const result = await upload(image, 'room-files', room.id);
    setAttachment(result.storagePath);
  });
  const milestone = useTask(async () => {
    await post(`/v1/shoot-rooms/${room.id}/milestones`, {
      title,
      dueAt: due ? new Date(due).toISOString() : null,
    });
    setTitle('');
    setDue('');
  });
  const propose = useTask(async () => {
    await post(`/v1/shoot-rooms/${room.id}/decisions`, { title: decision, description: '' });
    setDecision('');
  });
  const update = useTask(async (value: { path: string; body: unknown }) =>
    patch(value.path, value.body),
  );
  return (
    <div className="room-layout">
      <section className="panel">
        <h2>{t.booking.messages}</h2>
        <div className="room-messages">
          {w.messages.map((m) => (
            <article className={`room-message ${m.type === 'system' ? 'system' : ''}`} key={m.id}>
              <small>{dateTime(m.createdAt)}</small>
              <p>
                {m.type === 'system'
                  ? (t.statuses[m.text as keyof typeof t.statuses] ?? m.text)
                  : m.text}
              </p>
              {m.url ? (
                <a href={m.url} target="_blank" rel="noreferrer">
                  <img src={m.url} alt={m.text || t.project.reference} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
        {closed ? (
          <p>{t.booking.closed}</p>
        ) : (
          <Form onSubmit={() => send.mutate()}>
            <Area
              label={t.booking.messages}
              value={text}
              onChange={setText}
              placeholder={t.booking.messagePlaceholder}
            />
            <div className="row wrap">
              <FilePicker
                label={attachment ? t.explore.referenceReady : t.project.addReference}
                onFile={(image) => file.mutate(image)}
                disabled={file.isPending}
              />
              <Action type="submit" pending={send.isPending} disabled={!text.trim() && !attachment}>
                {t.booking.send}
              </Action>
            </div>
          </Form>
        )}
        <Feedback error={send.error ?? file.error} />
      </section>
      <aside>
        <section className="panel">
          <h2>{t.booking.decisions}</h2>
          {w.decisions.map((d) => (
            <article key={d.id} className="decision">
              <strong>{d.title}</strong>
              <span className="status">
                {d.status === 'agreed'
                  ? t.booking.agreed
                  : d.status === 'rejected'
                    ? t.booking.reject
                    : t.booking.waiting}
              </span>
              {d.status === 'proposed' && !closed ? (
                <div className="row">
                  <Action
                    secondary
                    onClick={() =>
                      update.mutate({
                        path: `/v1/shoot-rooms/${room.id}/decisions/${d.id}`,
                        body: { status: 'agreed' },
                      })
                    }
                  >
                    {t.booking.agree}
                  </Action>
                  <Action
                    secondary
                    onClick={() =>
                      update.mutate({
                        path: `/v1/shoot-rooms/${room.id}/decisions/${d.id}`,
                        body: { status: 'rejected' },
                      })
                    }
                  >
                    {t.booking.reject}
                  </Action>
                </div>
              ) : null}
            </article>
          ))}
          {!closed ? (
            <Form onSubmit={() => propose.mutate()}>
              <Field label={t.booking.newDecision} value={decision} onChange={setDecision} />
              <Action type="submit" pending={propose.isPending} disabled={!decision.trim()}>
                {t.booking.newDecision}
              </Action>
            </Form>
          ) : null}
        </section>
        <section className="panel">
          <h2>{t.booking.milestones}</h2>
          {w.milestones.map((m) => (
            <label className="checkbox-row" key={m.id}>
              <input
                type="checkbox"
                checked={m.status === 'done'}
                disabled={closed || update.isPending}
                onChange={(e) =>
                  update.mutate({
                    path: `/v1/shoot-rooms/${room.id}/milestones/${m.id}`,
                    body: { status: e.target.checked ? 'done' : 'todo' },
                  })
                }
              />
              <span>
                {m.title}
                {m.dueAt ? <small>{dateTime(m.dueAt)}</small> : null}
              </span>
            </label>
          ))}
          {!closed ? (
            <Form onSubmit={() => milestone.mutate()}>
              <Field label={t.booking.newMilestone} value={title} onChange={setTitle} />
              <DateField label={t.booking.due} value={due} onChange={setDue} required={false} />
              <Action type="submit" pending={milestone.isPending} disabled={!title.trim()}>
                {t.booking.newMilestone}
              </Action>
            </Form>
          ) : null}
          <Feedback error={milestone.error ?? propose.error ?? update.error} />
        </section>
      </aside>
    </div>
  );
}
