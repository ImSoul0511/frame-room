import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Area, Feedback, Form, Modal, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { DemoTabs } from './ui';
import type { DemoReport } from './types';

export function WorkspaceModerationPage() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [tab, setTab] = useState('reports');
  const [status, setStatus] = useState('pending');
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<
    | { type: 'report'; id: string; outcome: DemoReport['status'] }
    | { type: 'review'; id: string; visible: boolean }
    | { type: 'hold'; id: string; hold: boolean }
    | null
  >(null);
  const open = (value: typeof decision) => {
    task.clear();
    setReason('');
    setDecision(value);
  };
  const submit = () => {
    if (!decision) return;
    const result =
      decision.type === 'report'
        ? task.execute({ type: 'moderate', id: decision.id, outcome: decision.outcome, reason })
        : decision.type === 'review'
          ? task.execute({
              type: 'review-visibility',
              id: decision.id,
              visible: decision.visible,
              reason,
            })
          : task.execute({ type: 'hold', id: decision.id, hold: decision.hold, reason });
    if (result) setDecision(null);
  };
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{t.demo.admin}</p>
          <h1>{t.demo.moderation}</h1>
        </div>
        {demo.choice === 'account' ? (
          <Link className="button-link" to="/admin/booking-completions">
            {t.booking.manageCompletion}
          </Link>
        ) : null}
      </header>
      <DemoTabs
        tabs={[
          { id: 'reports', label: t.demo.moderation },
          { id: 'reviews', label: t.demo.reassessment },
          { id: 'holds', label: t.demo.hold },
        ]}
        value={tab}
        onChange={setTab}
      >
        {tab === 'reports' ? (
          <>
            <div className="workspace-owner-picker">
              <Select label={t.portfolio.status} value={status} onChange={setStatus}>
                {(['pending', 'actioned', 'dismissed'] as const).map((key) => (
                  <option value={key} key={key}>
                    {t.demo[key]}
                  </option>
                ))}
              </Select>
            </div>
            {demo.state.reports
              .filter((report) => report.status === status)
              .map((report) => (
                <article className="workspace-card" key={report.id}>
                  <div className="row between wrap">
                    <h3>{demo.text(report.title)}</h3>
                    <span className="status">{t.demo[report.status]}</span>
                  </div>
                  <p>
                    {t.reportReasons[report.reason as keyof typeof t.reportReasons] ??
                      report.reason}
                  </p>
                  <p>{demo.text(report.details)}</p>
                  {report.decision ? <p className="workspace-hint">{report.decision}</p> : null}
                  <div className="row wrap">
                    <Action
                      onClick={() => open({ type: 'report', id: report.id, outcome: 'actioned' })}
                    >
                      {t.demo.hide}
                    </Action>
                    <Action
                      secondary
                      onClick={() => open({ type: 'report', id: report.id, outcome: 'dismissed' })}
                    >
                      {t.demo.dismiss}
                    </Action>
                    <button
                      className="text-button"
                      onClick={() => open({ type: 'report', id: report.id, outcome: 'pending' })}
                    >
                      {t.demo.defer}
                    </button>
                  </div>
                </article>
              ))}
            {!demo.state.reports.some((report) => report.status === status) ? (
              <p className="empty-state">{t.demo.noResults}</p>
            ) : null}
          </>
        ) : tab === 'reviews' ? (
          <>
            {demo.state.reviews
              .filter((review) => review.hidden && review.reassessment)
              .map((review) => (
                <article className="workspace-card" key={review.id}>
                  <span className="review-stars">{'★'.repeat(review.rating)}</span>
                  <p>{review.comment}</p>
                  <p className="muted">{review.reason}</p>
                  <div className="row wrap">
                    <Action onClick={() => open({ type: 'review', id: review.id, visible: true })}>
                      {t.demo.restore}
                    </Action>
                    <Action
                      secondary
                      onClick={() => open({ type: 'review', id: review.id, visible: false })}
                    >
                      {t.demo.keepHidden}
                    </Action>
                  </div>
                </article>
              ))}
            {!demo.state.reviews.some((review) => review.hidden && review.reassessment) ? (
              <p className="empty-state">{t.demo.noResults}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="workspace-hint">{t.demo.demoNote}</p>
            <Action secondary onClick={() => task.execute({ type: 'advance', hours: 168 })}>
              {t.demo.advance}
            </Action>
            {demo.state.bookings
              .filter((booking) => booking.status === 'delivered')
              .map((booking) => (
                <article className="workspace-list-row" key={booking.id}>
                  <div>
                    <strong>{demo.text(booking.service.name)}</strong>
                    <small>
                      {booking.hold
                        ? t.demo.onHold
                        : `${Math.ceil(booking.remainingMs / 3600000)} ${t.demo.hours}`}
                    </small>
                  </div>
                  <Action
                    secondary
                    onClick={() => open({ type: 'hold', id: booking.id, hold: !booking.hold })}
                  >
                    {booking.hold ? t.demo.releaseHold : t.demo.hold}
                  </Action>
                </article>
              ))}
            {!demo.state.bookings.some((booking) => booking.status === 'delivered') ? (
              <p className="empty-state">{t.demo.noResults}</p>
            ) : null}
          </>
        )}
        <Feedback error={task.error} />
      </DemoTabs>
      {decision ? (
        <Modal title={t.demo.decisionReason} onClose={() => setDecision(null)}>
          <Form onSubmit={submit}>
            <Area label={t.demo.decisionReason} value={reason} onChange={setReason} />
            <Feedback error={task.error} />
            <Action type="submit" disabled={!reason.trim()}>
              {t.continue}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
