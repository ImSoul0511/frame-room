import { useState } from 'react';
import type { Workspace } from '../../lib/types';
import { post, patch, upload, dateTime } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import {
  Action,
  Area,
  DateField,
  Feedback,
  Field,
  FilePicker,
  Form,
  NumberField,
} from '../../components/ui';
import { MessageAttachment } from './MessageAttachment';

export function RoomPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [decision, setDecision] = useState('');
  const [description, setDescription] = useState('');
  const [changeTerms, setChangeTerms] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [quantity, setQuantity] = useState(w.booking.quantity ?? 1);
  const room = w.room!;
  const closed = room.status === 'closed';
  const send = useTask(
    async (draft: { submissionId: string; text: string; storagePath: string | null }) => {
      await post(
        `/v1/shoot-rooms/${room.id}/messages`,
        { text: draft.text, storagePath: draft.storagePath },
        draft.submissionId,
      );
      setText('');
      setAttachment(null);
      setSubmissionId(crypto.randomUUID());
    },
  );
  const file = useTask(async (image: File) => {
    const result = await upload(image, 'room-files', room.id);
    setAttachment(result.storagePath);
    setSubmissionId(crypto.randomUUID());
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
    const iso = (value: string) => (value ? new Date(`${value}+07:00`).toISOString() : undefined);
    await post(`/v1/shoot-rooms/${room.id}/decisions`, {
      title: decision,
      description,
      changes: changeTerms
        ? { scheduledStart: iso(newStart), scheduledEnd: iso(newEnd), quantity }
        : undefined,
    });
    setDecision('');
    setDescription('');
    setChangeTerms(false);
    setNewStart('');
    setNewEnd('');
  });
  const update = useTask(async (value: { path: string; body: unknown }) =>
    patch(value.path, value.body),
  );
  const confirmed = Boolean(
    send.variables &&
    w.messages.some((message) => message.submissionId === send.variables?.submissionId),
  );
  const pendingMessage =
    (send.isPending || send.isError) &&
    send.variables &&
    (send.isPending || send.variables.submissionId === submissionId) &&
    !w.messages.some((message) => message.submissionId === send.variables?.submissionId)
      ? send.variables
      : null;
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
              {m.storagePath ? <MessageAttachment messageId={m.id} /> : null}
            </article>
          ))}
          {pendingMessage ? (
            <article className="room-message mine">
              <small role="status">
                {send.isError ? t.messaging.sendFailed : t.messaging.sending}
              </small>
              <p>{pendingMessage.text}</p>
              {pendingMessage.storagePath ? <small>{t.messaging.imageAttached}</small> : null}
            </article>
          ) : null}
        </div>
        {closed ? (
          <p>{t.booking.closed}</p>
        ) : (
          <Form
            onSubmit={() => {
              if (!send.isPending && !file.isPending)
                send.mutate({ submissionId, text, storagePath: attachment });
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
                placeholder={t.booking.messagePlaceholder}
              />
              <div className="row wrap">
                <FilePicker
                  label={attachment ? t.explore.referenceReady : t.project.addReference}
                  onFile={(image) => file.mutate(image)}
                  disabled={file.isPending}
                />
                <Action
                  type="submit"
                  pending={send.isPending}
                  disabled={file.isPending || (!text.trim() && !attachment)}
                >
                  {t.booking.send}
                </Action>
              </div>
            </fieldset>
          </Form>
        )}
        <Feedback error={(confirmed ? null : send.error) ?? file.error} />
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
              {d.description && <p>{d.description}</p>}
              {d.changes?.proposed.scheduledStart && d.changes.before.scheduledStart && (
                <p>
                  {dateTime(d.changes.before.scheduledStart)} →{' '}
                  {dateTime(d.changes.proposed.scheduledStart)}
                </p>
              )}
              {d.changes?.proposed.quantity !== undefined &&
                d.changes.proposed.quantity !== d.changes.before.quantity && (
                  <p>
                    {t.workspaceUi.quantity} {d.changes.before.quantity ?? 1} →{' '}
                    {d.changes.proposed.quantity}
                  </p>
                )}
              {d.status === 'proposed' &&
              !closed &&
              (d.proposedBy === w.booking.clientId) !== w.isClient &&
              (!d.changes || w.isClient || w.canManage) ? (
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
              <Area label={t.workspaceUi.notes} value={description} onChange={setDescription} />
              {(w.isClient || w.canManage) && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={changeTerms}
                    onChange={(event) => setChangeTerms(event.target.checked)}
                  />
                  {t.booking.reschedule} / {t.workspaceUi.quantity}
                </label>
              )}
              {changeTerms && (
                <>
                  <DateField
                    label={t.booking.start}
                    value={newStart}
                    onChange={setNewStart}
                    required={false}
                  />
                  <DateField
                    label={t.booking.end}
                    value={newEnd}
                    onChange={setNewEnd}
                    required={false}
                  />
                  <p className="muted">UTC+7</p>
                  <NumberField
                    label={t.workspaceUi.quantity}
                    value={quantity}
                    onChange={setQuantity}
                    min={1}
                    max={1000}
                  />
                </>
              )}
              <Action
                type="submit"
                pending={propose.isPending}
                disabled={
                  !decision.trim() || (changeTerms && Boolean(newStart) !== Boolean(newEnd))
                }
              >
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
                checked={
                  update.isPending &&
                  update.variables?.path === `/v1/shoot-rooms/${room.id}/milestones/${m.id}`
                    ? (update.variables.body as { status: string }).status === 'done'
                    : m.status === 'done'
                }
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
                {m.updatedAt ? <small>{dateTime(m.updatedAt)}</small> : null}
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
