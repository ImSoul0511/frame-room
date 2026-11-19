import { useState } from 'react';
import { Action, Area, Feedback, Form, Modal } from '../../components/ui';
import { dateTime, currency } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { canManageBooking } from './permissions';
import { currentBrief } from './model';
import { BriefFields } from './ui';
import type { DemoBooking } from './types';

export function DemoBriefPanel({ booking }: { booking: DemoBooking }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState('');
  const latest = currentBrief(booking);
  const [value, setValue] = useState({
    ...structuredClone(latest),
    concept: demo.text(latest.concept),
    location: demo.text(latest.location),
    crew: demo.text(latest.crew),
  });
  const editable =
    (demo.role === booking.client || canManageBooking(demo.state, demo.role, booking)) &&
    ['pending', 'confirmed', 'in_progress'].includes(booking.status);
  const approved = demo.role === booking.client ? latest.clientApproved : latest.providerApproved;
  return (
    <div className={editable ? 'workspace-brief-columns' : ''}>
      <section>
        <div className="section-header">
          <h2>{t.demo.brief}</h2>
          {editable && !approved && !latest.rejection ? (
            <div className="row wrap">
              <Action onClick={() => task.execute({ type: 'approve', id: booking.id })}>
                {t.demo.approve}
              </Action>
              <button
                className="text-button"
                onClick={() => {
                  setReason('');
                  setReject(true);
                }}
              >
                {t.demo.rejectBrief}
              </button>
            </div>
          ) : null}
        </div>
        <Feedback error={task.error} />
        {[...booking.briefs].reverse().map((brief) => (
          <article className="workspace-card" key={brief.version}>
            <div className="row between wrap">
              <h3>
                {t.booking.version} {brief.version}
              </h3>
              <span className="status">
                {brief.version === booking.agreedVersion
                  ? t.demo.effective
                  : brief.version === latest.version
                    ? t.demo.latest
                    : t.booking.version}
              </span>
            </div>
            <p className="workspace-concept">{demo.text(brief.concept)}</p>
            {brief.rejection ? (
              <p className="workspace-hint">
                {t.demo.briefRejected}: {brief.rejection.reason}
              </p>
            ) : null}
            <div className="workspace-approval-grid">
              <span>
                {t.demo.clientApproval}
                <strong>{brief.clientApproved ? t.demo.approved : t.demo.waiting}</strong>
              </span>
              <span>
                {t.demo.providerApproval}
                <strong>{brief.providerApproved ? t.demo.approved : t.demo.waiting}</strong>
              </span>
            </div>
            <dl className="workspace-facts">
              <div>
                <dt>{t.demo.location}</dt>
                <dd>{demo.text(brief.location)}</dd>
              </div>
              <div>
                <dt>{t.demo.startTime}</dt>
                <dd>{dateTime(brief.startsAt)}</dd>
              </div>
              <div>
                <dt>{t.demo.endTime}</dt>
                <dd>{dateTime(brief.endsAt)}</dd>
              </div>
              <div>
                <dt>
                  {t.demo.photos} / {t.demo.retouched}
                </dt>
                <dd>
                  {brief.photoCount} / {brief.retouched}
                </dd>
              </div>
              <div>
                <dt>
                  {t.demo.quota} / {t.demo.revisions}
                </dt>
                <dd>
                  {brief.quota} / {brief.revisions}
                </dd>
              </div>
              <div>
                <dt>{t.demo.budget}</dt>
                <dd>{currency(brief.budget)}</dd>
              </div>
              <div>
                <dt>{t.demo.people}</dt>
                <dd>{brief.people}</dd>
              </div>
              <div>
                <dt>{t.demo.crew}</dt>
                <dd>{demo.text(brief.crew)}</dd>
              </div>
            </dl>
            {brief.note ? <p>{brief.note}</p> : null}
            <div className="workspace-files">
              {brief.references.map((file) => (
                <a key={file.id} href={file.url} target="_blank" rel="noreferrer">
                  {file.name}
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>
      {editable ? (
        <section className="workspace-card">
          <h2>{t.demo.proposeBrief}</h2>
          <p className="workspace-hint">{t.demo.scopeHint}</p>
          <Form onSubmit={() => task.execute({ type: 'brief', id: booking.id, brief: value })}>
            <BriefFields value={value} onChange={setValue} />
            <Feedback error={task.error} />
            <Action type="submit">{t.demo.proposeBrief}</Action>
          </Form>
        </section>
      ) : null}
      {reject ? (
        <Modal title={t.demo.rejectBrief} onClose={() => setReject(false)}>
          <Form
            onSubmit={() => {
              if (task.execute({ type: 'brief-reject', id: booking.id, reason })) setReject(false);
            }}
          >
            <Area label={t.demo.reason} value={reason} onChange={setReason} />
            <Feedback error={task.error} />
            <Action type="submit" disabled={!reason.trim()}>
              {t.demo.rejectBrief}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </div>
  );
}
