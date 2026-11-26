import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Booking } from '@frameroom/shared';
import type { Workspace } from '../lib/types';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { api, currency, dateTime, patch, post, supabase } from '../lib/api';
import { uploadDelivery, type DeliveryUpload } from '../features/booking/deliveryUpload';
import { useQueryClient } from '@tanstack/react-query';
import {
  Action,
  Area,
  Feedback,
  FilePicker,
  Form,
  NumberField,
  PageHeading,
  QueryState,
  Status,
} from '../components/ui';
import { BriefEditor } from '../features/projects/BriefEditor';
import { ChatPanel } from '../features/projects/ChatPanel';
import { BookingControls } from '../features/booking/BookingControls';
import { RoomPanel } from '../features/booking/RoomPanel';
import { GalleryPanel } from '../features/booking/GalleryPanel';
import { CompletionStatus } from '../features/booking/CompletionStatus';
import { BookingCalendar } from '../features/booking/BookingCalendar';

export function BookingsPage() {
  const t = useStrings();
  const list = useApi<Booking[]>('/v1/bookings');
  return (
    <>
      <PageHeading
        title={t.workspaceUi.bookings}
        subtitle={t.design.calendarDescription}
        action={
          <Link className="button-link dark" to="/explore">
            {t.workspaceUi.newBooking}
          </Link>
        }
      />
      <QueryState query={list} empty={list.data?.length === 0} />
      <div className="booking-list">
        {list.data?.map((b) => (
          <Link key={b.id} to={`/bookings/${b.id}`} className="booking-card">
            <div className="booking-date">
              <strong>{new Date(b.scheduledStart).getDate()}</strong>
              <small>{dateTime(b.scheduledStart)}</small>
            </div>
            <div>
              <h2>{b.serviceName}</h2>
              <span>{currency(b.totalPrice)}</span>
            </div>
            <Status status={b.status} />
            <span className="text-button">{t.design.viewBooking}</span>
          </Link>
        ))}
      </div>
      {list.isSuccess ? <BookingCalendar bookings={list.data} /> : null}
    </>
  );
}
export function BookingPage() {
  const t = useStrings();
  const { id = '' } = useParams();
  const data = useApi<Workspace>(`/v1/bookings/${id}/workspace`, true, 30000);
  const [tab, setTab] = useState('brief');
  const client = useQueryClient();
  useEffect(() => {
    const roomId = data.data?.room?.id;
    if (!supabase || !roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        () => void client.invalidateQueries({ queryKey: ['api'] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_decisions', filter: `room_id=eq.${roomId}` },
        () => void client.invalidateQueries({ queryKey: ['api'] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_milestones', filter: `room_id=eq.${roomId}` },
        () => void client.invalidateQueries({ queryKey: ['api'] }),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [data.data?.room?.id, client]);
  if (!data.data) return <QueryState query={data} />;
  const w = data.data;
  const b = w.booking;
  const hasRoom = Boolean(w.room) && ['confirmed', 'in_progress'].includes(b.status);
  const canProof = ['in_progress', 'proofing', 'delivered', 'completed'].includes(b.status);
  const tabs = (['brief', 'room', 'gallery', 'delivery', 'assistant'] as const).filter((key) =>
    key === 'room' ? hasRoom : key === 'gallery' || key === 'delivery' ? canProof : true,
  );
  const selected = tabs.find((key) => key === tab) ?? 'brief';
  return (
    <>
      <PageHeading
        title={b.serviceName}
        subtitle={`${dateTime(b.scheduledStart)} — ${currency(b.totalPrice)}`}
        action={<Status status={b.status} />}
      />
      {b.status === 'delivered' ? <CompletionStatus booking={b} /> : null}
      <BookingControls key={b.version} workspace={w} />
      <div className="tabs" role="tablist">
        {tabs.map((k) => (
          <button role="tab" key={k} aria-selected={selected === k} onClick={() => setTab(k)}>
            {k === 'assistant' ? t.project.assistant : t.booking[k]}
          </button>
        ))}
      </div>
      {selected === 'brief' ? (
        <BriefPanel workspace={w} />
      ) : selected === 'room' && w.room ? (
        <RoomPanel workspace={w} />
      ) : selected === 'gallery' ? (
        <GalleryPanel key={`${w.gallery?.round}-${w.gallery?.status}`} workspace={w} />
      ) : selected === 'delivery' ? (
        <DeliveryPanel
          key={w.review?.reassessmentRequestedAt ?? String(w.review?.isHidden)}
          workspace={w}
        />
      ) : selected === 'assistant' ? (
        <ChatPanel projectId={b.projectId} />
      ) : null}
    </>
  );
}
function BriefPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const create = useTask(async (brief: Workspace['briefs'][number]['content']) =>
    post(`/v1/bookings/${w.booking.id}/brief-versions`, brief),
  );
  const approve = useTask(async (id: string) =>
    post(`/v1/bookings/${w.booking.id}/brief-versions/${id}/approve`),
  );
  const [reason, setReason] = useState('');
  const request = useTask(async (id: string) =>
    post(`/v1/bookings/${w.booking.id}/brief-versions/${id}/revision`, { reason }),
  );
  const editable =
    ['confirmed', 'in_progress'].includes(w.booking.status) ||
    (w.booking.status === 'pending' && (w.isClient || w.canManage));
  const latest = w.briefs[0];
  const baseline = latest?.content ??
    w.project.brief ?? {
      title: w.project.title,
      concept: w.project.idea,
      shotList: [],
      lighting: [],
      checklist: [],
      milestones: [],
    };
  return (
    <div className="two-col">
      <section>
        <h2>{t.booking.brief}</h2>
        {w.briefs.map((v) => (
          <article key={v.id} className="panel">
            <div className="row between">
              <h3>
                {t.booking.version} {v.version}
              </h3>
              <span className="status">
                {w.booking.agreedBriefVersion === v.version ? t.booking.agreed : t.booking.waiting}
              </span>
            </div>
            <p>{v.content.concept}</p>
            {v.content.requirements ? (
              <BriefRequirements bookingId={w.booking.id} brief={v} />
            ) : null}
            {(['shotList', 'lighting', 'checklist', 'milestones'] as const).map((k) =>
              v.content[k].length ? (
                <div key={k}>
                  <h4>{t.project[k]}</h4>
                  <ul>
                    {v.content[k].map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            {editable &&
            latest.id === v.id &&
            v.status !== 'closed' &&
            (!(w.isClient ? v.clientApproved : v.providerApproved) ||
              (w.booking.status === 'pending' && w.canManage)) ? (
              <>
                {!(w.isClient ? v.clientApproved : v.providerApproved) ? (
                  <Action
                    secondary
                    pending={approve.isPending}
                    onClick={() => approve.mutate(v.id)}
                  >
                    {t.booking.approveBrief}
                  </Action>
                ) : null}
                <Area label={t.booking.reason} value={reason} onChange={setReason} />
                <Action
                  secondary
                  pending={request.isPending}
                  disabled={!reason.trim()}
                  onClick={() => request.mutate(v.id)}
                >
                  {t.booking.requestBriefRevision}
                </Action>
              </>
            ) : null}
          </article>
        ))}
        {!w.briefs.length ? <p>{t.booking.noBrief}</p> : null}
        <Feedback
          error={approve.error ?? request.error}
          success={request.isSuccess ? t.saved : null}
        />
      </section>
      {editable ? (
        <section className="panel">
          <h2>{t.booking.proposeBrief}</h2>
          <BriefEditor
            booking
            key={latest?.id ?? w.booking.id}
            initial={{
              ...baseline,
              requirements: {
                ...(baseline.requirements ?? {
                  genre: 'portrait',
                  locationType: 'studio',
                  location: '',
                  people: 1,
                  photoCount: Math.max(10, w.proofing.quota),
                  retouchedCount: w.proofing.quota,
                  revisionLimit: w.proofing.revisions,
                  budget: w.booking.totalPrice,
                  crew: '',
                  notes: '',
                  referencePaths: w.project.referencePaths,
                }),
                scheduledStart: baseline.requirements?.scheduledStart ?? w.booking.scheduledStart,
                scheduledEnd: baseline.requirements?.scheduledEnd ?? w.booking.scheduledEnd,
              },
            }}
            onSave={(value) => create.mutate(value)}
            pending={create.isPending}
            error={create.error}
          />
        </section>
      ) : null}
    </div>
  );
}

function BriefRequirements({
  bookingId,
  brief,
}: {
  bookingId: string;
  brief: Workspace['briefs'][number];
}) {
  const t = useStrings();
  const scope = brief.content.requirements!;
  return (
    <>
      <p>
        {t.genreLabels[scope.genre]}
        {scope.quantity !== undefined && ` · ${t.workspaceUi.quantity} ${scope.quantity}`}
        {['event', 'yearbook', 'wedding', 'family'].includes(scope.genre) &&
          ` · ${t.workspaceUi.shootSize} ${scope.people}`}
      </p>
      <p>
        {scope.location ? `${scope.location} · ` : ''}
        {scope.scheduledStart ? dateTime(scope.scheduledStart) : ''}
        {scope.scheduledEnd ? ` – ${dateTime(scope.scheduledEnd)}` : ''}
      </p>
      <p>
        {t.workspaceUi.photos} {scope.photoCount} · {t.workspaceUi.retouched} {scope.retouchedCount}{' '}
        · {t.workspaceUi.revisions} {scope.revisionLimit} · {currency(scope.budget)}
      </p>
      {scope.crew ? <p>{scope.crew}</p> : null}
      {scope.highlightsDueAt && (
        <p>
          {t.workspaceUi.highlightsDue} · {dateTime(scope.highlightsDueAt)}
        </p>
      )}
      {scope.deliveryDueAt && (
        <p>
          {t.workspaceUi.deliveryDue} · {dateTime(scope.deliveryDueAt)}
        </p>
      )}
      {scope.notes ? <p>{scope.notes}</p> : null}
      {scope.referencePaths.map((path, index) => (
        <BriefReference
          key={path}
          url={`/v1/bookings/${bookingId}/brief-versions/${brief.id}/reference?index=${index}`}
          index={index}
        />
      ))}
    </>
  );
}

function BriefReference({ url, index }: { url: string; index: number }) {
  const t = useStrings();
  const load = useTask(async () => api<{ url: string }>(url));
  return (
    <div>
      {load.data ? (
        <a href={load.data.url} target="_blank" rel="noreferrer">
          {t.project.reference} {index + 1}
        </a>
      ) : (
        <Action
          secondary
          pending={load.isPending}
          onClick={() => load.mutate()}
        >{`${t.project.reference} ${index + 1}`}</Action>
      )}
      <Feedback error={load.error} />
    </div>
  );
}
function DeliveryPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [rating, setRating] = useState(w.review?.rating ?? 5);
  const [comment, setComment] = useState(w.review?.comment ?? '');
  const canResubmit = Boolean(
    w.review?.isHidden &&
    w.review.moderationReason &&
    !w.review.reassessmentRequestedAt &&
    !w.review.deletedAt,
  );
  const add = useTask((transfer: DeliveryUpload) => uploadDelivery(w.booking.id, transfer));
  const review = useTask(async () =>
    canResubmit
      ? patch(`/v1/bookings/${w.booking.id}/review`, { rating, comment })
      : post(`/v1/bookings/${w.booking.id}/reviews`, { rating, comment }),
  );
  return (
    <section className="panel">
      <h2>{t.booking.delivery}</h2>
      {w.isProvider &&
      w.booking.status === 'proofing' &&
      w.gallery?.status === 'selection_submitted' &&
      (!w.proofing.mode || w.gallery.approvedRound === w.gallery.round) &&
      !w.gallery.revisionRequestedAt ? (
        <>
          <p className="muted">{t.workspaceUi.originalFileHint}</p>
          <FilePicker
            label={t.booking.addDelivery}
            accept="image/jpeg,image/png,image/webp,.zip,.dng,.cr2,.cr3,.nef,.arw,.raf,.orf,.rw2,.raw"
            onFile={(file) => add.mutate({ file })}
            disabled={add.isPending}
          />
        </>
      ) : null}
      {w.deliveries.map((file) => (
        <a className="list-row" href={file.url} key={file.id} target="_blank" rel="noreferrer">
          <span>
            {file.fileName}
            {file.sizeBytes ? ` · ${(Number(file.sizeBytes) / 1048576).toFixed(1)} MiB` : ''}
          </span>
          <span>{t.booking.download} ↗</span>
        </a>
      ))}
      <Feedback error={add.error} />
      {add.isError && add.variables && (
        <Action secondary onClick={() => add.mutate(add.variables)}>
          {t.retry}
        </Action>
      )}
      {w.isClient && w.review?.moderationReason ? (
        <p>
          {t.workspaceUi.reviewHidden} · {w.review.moderationReason}
        </p>
      ) : null}
      {w.isClient && w.booking.status === 'completed' && (!w.review || canResubmit) ? (
        <Form onSubmit={() => review.mutate()}>
          <h2>{t.booking.review}</h2>
          <NumberField
            label={t.booking.rating}
            value={rating}
            onChange={setRating}
            min={1}
            max={5}
          />
          <Area label={t.booking.comment} value={comment} onChange={setComment} />
          <Feedback error={review.error} />
          <Action type="submit" pending={review.isPending}>
            {canResubmit ? t.workspaceUi.resubmitReview : t.booking.submitReview}
          </Action>
        </Form>
      ) : w.review && !w.review.deletedAt ? (
        <blockquote className="review">
          {'★'.repeat(w.review.rating)}
          <p>{w.review.comment}</p>
        </blockquote>
      ) : null}
    </section>
  );
}
