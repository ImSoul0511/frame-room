import { Link } from 'react-router-dom';
import { Action, Feedback, PageHeading, QueryState } from '../components/ui';
import { dateTime, patch } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';

type Notice = {
  id: string;
  bookingId: string | null;
  studioId: string | null;
  event: string;
  createdAt: string;
  readAt: string | null;
};

export function NotificationsPage() {
  const t = useStrings();
  const list = useApi<Notice[]>('/v1/me/notifications', true, 15000);
  const mark = useTask(async (id: string) => patch(`/v1/me/notifications/${id}`, {}));
  return (
    <>
      <PageHeading title={t.demo.notifications} />
      <QueryState query={list} empty={list.data?.length === 0} />
      <Feedback error={mark.error} />
      {list.data?.map((notice) => {
        const title = t.demo[notice.event as keyof typeof t.demo] ?? t.demo.notifications;
        const destination = notice.bookingId
          ? `/bookings/${notice.bookingId}`
          : notice.studioId
            ? '/studio'
            : null;
        return (
          <article className="list-row" key={notice.id}>
            <div>
              {destination ? <Link to={destination}>{title}</Link> : <strong>{title}</strong>}
              <p>{dateTime(notice.createdAt)}</p>
            </div>
            {!notice.readAt ? (
              <Action secondary pending={mark.isPending} onClick={() => mark.mutate(notice.id)}>
                {t.demo.markRead}
              </Action>
            ) : null}
          </article>
        );
      })}
    </>
  );
}
