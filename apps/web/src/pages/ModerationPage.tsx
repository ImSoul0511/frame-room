import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Area, Feedback, Form, PageHeading, QueryState } from '../components/ui';
import { dateTime, post } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';

type Report = {
  id: string;
  targetType: 'portfolio' | 'portfolio_image' | 'review';
  targetId: string;
  reason: string;
  description: string;
  status: 'open' | 'resolved';
  outcome: 'actioned' | 'dismissed' | null;
  createdAt: string;
};
type ReportDetail = {
  report: Report;
  target: {
    title?: string;
    caption?: string;
    comment?: string;
    description?: string;
    rating?: number;
  } | null;
  history: { id: string; actorId: string; action: string; reason: string; createdAt: string }[];
  imageUrl: string | null;
};
type Review = {
  id: string;
  rating: number;
  comment: string;
  moderationReason: string;
  reassessmentRequestedAt: string;
  history: (ReportDetail['history'][number] & {
    previousReview?: { rating: number; comment: string } | null;
  })[];
};

export function ModerationPage() {
  const t = useStrings();
  const [current, setCurrent] = useState<string | null>(null);
  const reports = useApi<Report[]>('/v1/admin/reports');
  const reviews = useApi<Review[]>('/v1/admin/review-reassessments');
  return (
    <>
      <PageHeading
        title={t.workspaceUi.moderation}
        action={<Link to="/admin/booking-completions">{t.booking.liveBookings}</Link>}
      />
      <div className="two-col">
        <section className="panel">
          <QueryState query={reports} empty={reports.data?.length === 0} />
          {reports.data?.map((report) => (
            <button
              key={report.id}
              type="button"
              className="list-row"
              aria-pressed={current === report.id}
              onClick={() => setCurrent(report.id)}
            >
              <span>
                {t.reportReasons[report.reason as keyof typeof t.reportReasons] ?? report.reason} ·{' '}
                {dateTime(report.createdAt)}
              </span>
              <span>
                {report.outcome
                  ? t.workspaceUi[report.outcome]
                  : report.status === 'open'
                    ? t.workspaceUi.pending
                    : t.admin.legacyResolved}
              </span>
            </button>
          ))}
        </section>
        {current ? <ReportPanel key={current} id={current} /> : null}
      </div>
      <section className="panel">
        <h2>{t.workspaceUi.reassessment}</h2>
        <QueryState query={reviews} empty={reviews.data?.length === 0} />
        {reviews.data?.map((review) => (
          <ReviewPanel key={review.id} review={review} />
        ))}
      </section>
    </>
  );
}

function ReportPanel({ id }: { id: string }) {
  const t = useStrings();
  const detail = useApi<ReportDetail>(`/v1/admin/reports/${id}`);
  const [reason, setReason] = useState('');
  const decide = useTask(async (decision: 'actioned' | 'dismissed' | 'deferred') =>
    post(`/v1/admin/reports/${id}/decisions`, { decision, reason }),
  );
  if (!detail.data) return <QueryState query={detail} />;
  const { report, target, history } = detail.data;
  return (
    <section className="panel">
      <h2>{target?.title || target?.caption || report.targetId}</h2>
      {detail.data.imageUrl ? (
        <img
          className="proofing-photo"
          src={detail.data.imageUrl}
          alt={target?.caption || t.profileUi.photo}
        />
      ) : null}
      {target ? <p>{target.comment || target.description}</p> : <p>{t.errors.not_found}</p>}
      {target?.rating ? <p>{target.rating} / 5</p> : null}
      <p>{report.description}</p>
      <ul>
        {history.map((event) => (
          <li key={event.id}>
            {dateTime(event.createdAt)} ·{' '}
            {t.workspaceUi[event.action as keyof typeof t.workspaceUi] ?? event.action} ·{' '}
            {event.actorId}
            <p>{event.reason}</p>
          </li>
        ))}
      </ul>
      {report.status === 'open' ? (
        <Form onSubmit={() => undefined}>
          <Area label={t.workspaceUi.decisionReason} value={reason} onChange={setReason} />
          <div className="row wrap">
            <Action
              disabled={!reason.trim() || !target}
              pending={decide.isPending}
              onClick={() => decide.mutate('actioned')}
            >
              {t.workspaceUi.hide}
            </Action>
            <Action
              secondary
              disabled={!reason.trim()}
              pending={decide.isPending}
              onClick={() => decide.mutate('dismissed')}
            >
              {t.workspaceUi.dismiss}
            </Action>
            <Action
              secondary
              disabled={!reason.trim()}
              pending={decide.isPending}
              onClick={() => decide.mutate('deferred')}
            >
              {t.workspaceUi.defer}
            </Action>
          </div>
          <Feedback error={decide.error} success={decide.isSuccess ? t.saved : null} />
        </Form>
      ) : null}
    </section>
  );
}

function ReviewPanel({ review }: { review: Review }) {
  const t = useStrings();
  const [reason, setReason] = useState('');
  const decide = useTask(async (approve: boolean) =>
    post(`/v1/admin/review-reassessments/${review.id}/decisions`, { approve, reason }),
  );
  return (
    <article className="panel">
      <p>
        {review.rating} / 5 · {dateTime(review.reassessmentRequestedAt)}
      </p>
      <blockquote>{review.comment}</blockquote>
      <p>{review.moderationReason}</p>
      <ul>
        {review.history.map((event) => (
          <li key={event.id}>
            {dateTime(event.createdAt)} ·{' '}
            {t.workspaceUi[event.action as keyof typeof t.workspaceUi] ?? event.action}
            {event.reason ? <p>{event.reason}</p> : null}
            {event.previousReview ? (
              <p>
                {event.previousReview.rating} / 5 · {event.previousReview.comment}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <Area label={t.workspaceUi.decisionReason} value={reason} onChange={setReason} />
      <div className="row wrap">
        <Action
          disabled={!reason.trim()}
          pending={decide.isPending}
          onClick={() => decide.mutate(true)}
        >
          {t.workspaceUi.restore}
        </Action>
        <Action
          secondary
          disabled={!reason.trim()}
          pending={decide.isPending}
          onClick={() => decide.mutate(false)}
        >
          {t.workspaceUi.keepHidden}
        </Action>
      </div>
      <Feedback error={decide.error} />
    </article>
  );
}
