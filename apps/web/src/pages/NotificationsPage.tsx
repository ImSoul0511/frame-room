import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Notification } from '@frameroom/shared';
import { Action, Feedback, PageHeading, QueryState } from '../components/ui';
import { dateTime, patch } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
export function NotificationsPage() {
  const t = useStrings();
  const [filter, setFilter] = useState('all');
  const list = useApi<Notification[]>(`/v1/me/notifications?state=${filter}`, true, 15000);
  const counts = useApi<{ unread: number; total: number }>(
    '/v1/me/notifications/counts',
    true,
    15000,
  );
  const mark = useTask((id: string) => patch(`/v1/me/notifications/${id}`, {}));
  const all = useTask(() => patch('/v1/me/notifications/read-all', {}));
  const unread = counts.data?.unread ?? 0;
  const items = list.data ?? [];
  return (
    <>
      <PageHeading
        title={t.demo.notifications}
        subtitle={t.tools.notificationsHint}
        action={
          <Action
            secondary
            pending={all.isPending}
            disabled={unread === 0 || counts.isError}
            onClick={() => all.mutate()}
          >
            {t.tools.markAllRead}
          </Action>
        }
      />
      <div className="notification-toolbar">
        <div className="row wrap">
          {(['all', 'unread', 'read'] as const).map((key) => (
            <button
              key={key}
              className="chip"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {key === 'all' ? t.all : t.tools[key]}
            </button>
          ))}
        </div>
        <p role="status">{counts.data ? `${unread} ${t.tools.unread}` : t.pending}</p>
      </div>
      <QueryState query={list} />
      <QueryState query={counts} />
      <p className="muted">{t.tools.recentNotifications}</p>
      <Feedback error={mark.error ?? all.error} />
      {list.data && !items.length ? (
        <p className="empty-state">{filter === 'unread' ? t.tools.caughtUp : t.empty}</p>
      ) : null}
      <div className="notification-list">
        {items.map((notice) => {
          const title = t.demo[notice.event as keyof typeof t.demo] ?? t.demo.notifications;
          const destination = notice.bookingId
            ? `/bookings/${notice.bookingId}`
            : notice.studioId
              ? `/studio/${notice.studioId}`
              : null;
          return (
            <article
              className={`notification-item ${notice.readAt ? '' : 'is-unread'}`}
              key={notice.id}
            >
              <span className="notification-dot" aria-hidden="true" />
              <div>
                {destination ? <Link to={destination}>{title}</Link> : <strong>{title}</strong>}
                <small>{dateTime(notice.createdAt)}</small>
              </div>
              {!notice.readAt ? (
                <Action secondary pending={mark.isPending} onClick={() => mark.mutate(notice.id)}>
                  {t.demo.markRead}
                </Action>
              ) : (
                <span className="eyebrow">{t.tools.read}</span>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
