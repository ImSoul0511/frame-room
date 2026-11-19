import { useState } from 'react';
import { Action, Area, Feedback, Form, NumberField } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { canWorkBooking } from './permissions';
import { selectionSubmitted } from './model';
import { DemoReportButton } from './ReportButton';
import type { DemoBooking } from './types';

export function DemoDeliveryPanel({ booking }: { booking: DemoBooking }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const worker = canWorkBooking(demo.state, demo.role, booking);
  const visible = worker || ['delivered', 'completed'].includes(booking.status);
  const hours = Math.max(
    0,
    Math.ceil(
      (booking.remainingMs -
        (!booking.hold && booking.deliveredAt ? demo.state.clock - booking.deliveredAt : 0)) /
        3600000,
    ),
  );
  return (
    <>
      <h2>{t.demo.delivery}</h2>
      {booking.status === 'delivered' ? (
        <div className="workspace-countdown">
          <div>
            <span>{t.demo.remaining}</span>
            <strong>{booking.hold ? t.demo.onHold : `${hours} ${t.demo.hours}`}</strong>
          </div>
          {booking.hold ? <p>{booking.holdReason}</p> : null}
        </div>
      ) : null}
      {worker && booking.status === 'proofing' ? (
        <section className="workspace-card">
          <label className="workspace-file-button">
            {t.demo.deliveryFile}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/zip"
              disabled={!selectionSubmitted(booking)}
              onChange={(event) => {
                const source = event.target.files?.[0];
                if (source)
                  task.attempt(() =>
                    demo.dispatch({ type: 'delivery', id: booking.id, file: demo.file(source) }),
                  );
                event.target.value = '';
              }}
            />
          </label>
          <p className="muted">{t.demo.demoNote}</p>
        </section>
      ) : null}
      {visible ? (
        <div className="workspace-files">
          {booking.deliveries.map((file, index) => (
            <a
              className="workspace-list-row"
              key={file.id}
              href={demo.image(file.url, index)}
              download={file.name}
            >
              <span>{file.name}</span>
              <strong>{t.demo.download}</strong>
            </a>
          ))}
        </div>
      ) : (
        <p className="workspace-hint">{t.demoErrors.deliveryRequired ?? t.demo.waiting}</p>
      )}
      {worker && booking.status === 'proofing' ? (
        <Action
          disabled={!booking.deliveries.length || !selectionSubmitted(booking)}
          onClick={() => task.execute({ type: 'deliver', id: booking.id })}
        >
          {t.demo.deliver}
        </Action>
      ) : null}
      {demo.role === booking.client && booking.status === 'delivered' ? (
        <Action
          disabled={booking.hold}
          onClick={() => task.execute({ type: 'complete', id: booking.id })}
        >
          {t.demo.complete}
        </Action>
      ) : null}
      <Feedback error={task.error} />
    </>
  );
}
export function DemoReviewPanel({ booking }: { booking: DemoBooking }) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const existing = demo.state.reviews.find((review) => review.booking === booking.id);
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const editable =
    demo.role === booking.client &&
    booking.status === 'completed' &&
    (!existing || (existing.hidden && !existing.deleted));
  return (
    <>
      <h2>{t.demo.review}</h2>
      {existing && (!existing.hidden || demo.role === booking.client) ? (
        <article className="profile-review">
          <span className="review-stars">{'★'.repeat(existing.rating)}</span>
          <p>{existing.comment}</p>
          {existing.hidden ? (
            <p className="workspace-hint">
              {t.demo.reviewHidden} · {existing.reason}
            </p>
          ) : (
            <DemoReportButton
              targetType="review"
              targetId={existing.id}
              title={demo.text(booking.service.name)}
            />
          )}
        </article>
      ) : null}
      {editable ? (
        <section className="workspace-card">
          <Form onSubmit={() => task.execute({ type: 'review', id: booking.id, rating, comment })}>
            <NumberField label={t.demo.rating} value={rating} min={1} onChange={setRating} />
            <Area label={t.demo.comment} value={comment} onChange={setComment} />
            <p className="muted">{comment.length} / 1.000</p>
            <Feedback error={task.error} />
            <Action
              type="submit"
              disabled={
                rating < 1 || rating > 5 || comment.length > 1000 || Boolean(existing?.reassessment)
              }
            >
              {existing ? t.demo.resubmitReview : t.demo.submitReview}
            </Action>
          </Form>
        </section>
      ) : existing ? (
        <p className="muted">{t.demo.reviewExists}</p>
      ) : (
        <p className="empty-state">{t.profileUi.noReviews}</p>
      )}
    </>
  );
}
