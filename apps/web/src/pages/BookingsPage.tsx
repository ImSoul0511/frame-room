import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Booking } from '@frameroom/shared';
import type { Workspace } from '../lib/types';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { currency, dateTime, post, supabase, upload } from '../lib/api';
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

export function BookingsPage() {
  const t = useStrings();
  const list = useApi<Booking[]>('/v1/bookings');
  return (
    <>
      <PageHeading title={t.booking.title} subtitle={t.booking.subtitle} />
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
            <span>↗</span>
          </Link>
        ))}
      </div>
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
  return (
    <>
      <PageHeading
        title={b.serviceName}
        subtitle={`${dateTime(b.scheduledStart)} — ${currency(b.totalPrice)}`}
        action={<Status status={b.status} />}
      />
      <BookingControls key={b.version} workspace={w} />
      <div className="tabs" role="tablist">
        {(['brief', 'room', 'gallery', 'delivery', 'assistant'] as const)
          .filter((k) => k === 'brief' || k === 'assistant' || Boolean(w.room))
          .map((k) => (
            <button role="tab" key={k} aria-selected={tab === k} onClick={() => setTab(k)}>
              {k === 'assistant' ? t.project.assistant : t.booking[k]}
            </button>
          ))}
      </div>
      {tab === 'brief' ? (
        <BriefPanel workspace={w} />
      ) : tab === 'room' && w.room ? (
        <RoomPanel workspace={w} />
      ) : tab === 'gallery' ? (
        <GalleryPanel key={`${w.gallery?.round}-${w.gallery?.status}`} workspace={w} />
      ) : tab === 'delivery' ? (
        <DeliveryPanel workspace={w} />
      ) : tab === 'assistant' ? (
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
  const editable = ['pending', 'confirmed', 'in_progress'].includes(w.booking.status);
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
            {editable && !(w.isClient ? v.clientApproved : v.providerApproved) ? (
              <Action secondary pending={approve.isPending} onClick={() => approve.mutate(v.id)}>
                {t.booking.approveBrief}
              </Action>
            ) : null}
          </article>
        ))}
        {!w.briefs.length ? <p>{t.booking.noBrief}</p> : null}
        <Feedback error={approve.error} />
      </section>
      {editable ? (
        <section className="panel">
          <h2>{t.booking.proposeBrief}</h2>
          <BriefEditor
            initial={
              w.project.brief ?? {
                title: w.project.title,
                concept: w.project.idea,
                shotList: [],
                lighting: [],
                checklist: [],
                milestones: [],
              }
            }
            onSave={(value) => create.mutate(value)}
            pending={create.isPending}
            error={create.error}
          />
        </section>
      ) : null}
    </div>
  );
}
function DeliveryPanel({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const add = useTask(async (file: File) => {
    const result = await upload(file, 'deliveries', w.booking.id);
    return post(`/v1/bookings/${w.booking.id}/deliveries`, {
      storagePath: result.storagePath,
      fileName: file.name,
    });
  });
  const review = useTask(async () =>
    post(`/v1/bookings/${w.booking.id}/reviews`, { rating, comment }),
  );
  return (
    <section className="panel">
      <h2>{t.booking.delivery}</h2>
      {w.isProvider && w.booking.status === 'proofing' ? (
        <FilePicker
          label={t.booking.addDelivery}
          onFile={(file) => add.mutate(file)}
          disabled={add.isPending}
        />
      ) : null}
      {w.deliveries.map((file) => (
        <a className="list-row" href={file.url} key={file.id} target="_blank" rel="noreferrer">
          <span>{file.fileName}</span>
          <span>{t.booking.download} ↗</span>
        </a>
      ))}
      <Feedback error={add.error} />
      {w.isClient && w.booking.status === 'completed' && !w.review ? (
        <Form onSubmit={() => review.mutate()}>
          <h2>{t.booking.review}</h2>
          <NumberField label={t.booking.rating} value={rating} onChange={setRating} min={1} />
          <Area label={t.booking.comment} value={comment} onChange={setComment} />
          <Feedback error={review.error} />
          <Action type="submit" pending={review.isPending}>
            {t.booking.submitReview}
          </Action>
        </Form>
      ) : w.review ? (
        <blockquote className="review">
          {'★'.repeat(w.review.rating)}
          <p>{w.review.comment}</p>
        </blockquote>
      ) : null}
    </section>
  );
}
