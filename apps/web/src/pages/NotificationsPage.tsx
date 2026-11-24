import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Feedback, PageHeading, QueryState } from '../components/ui';
import { dateTime } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { useMarkNotificationRead, type Notice } from '../lib/notifications';

export function NotificationsPage() {
  const t = useStrings();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useApi<Notice[]>('/v1/me/notifications', true, 30000);
  const mark = useMarkNotificationRead();
  const notices = list.data?.filter((notice) => !unreadOnly || !notice.readAt) ?? [];
  return (
    <>
      <PageHeading
        title={t.workspaceUi.notifications}
        subtitle={t.design.notificationDescription}
      />
      <div className="genre-chips">
        <button
          className={unreadOnly ? 'chip' : 'chip selected'}
          aria-pressed={!unreadOnly}
          onClick={() => setUnreadOnly(false)}
        >
          {t.design.allNotices}
        </button>
        <button
          className={unreadOnly ? 'chip selected' : 'chip'}
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly(true)}
        >
          {t.design.unread}
        </button>
      </div>
      <QueryState query={list} empty={!unreadOnly && list.data?.length === 0} />
      <Feedback error={mark.error} />
      {unreadOnly && list.isSuccess && !notices.length ? (
        <p className="empty-state">{t.design.noUnread}</p>
      ) : null}
      <div className="notification-list">
        {notices.map((notice) => {
          const title =
            t.workspaceUi[notice.event as keyof typeof t.workspaceUi] ??
            t.workspaceUi.notifications;
          const destination = notice.bookingId
            ? `/bookings/${notice.bookingId}`
            : notice.studioId
              ? `/studio/${notice.studioId}`
              : null;
          return (
            <article
              className={`notification-card ${notice.readAt ? 'is-read' : ''}`}
              key={notice.id}
            >
              <div className="row between wrap">
                <div>
                  <span className="eyebrow">{notice.readAt ? t.design.read : t.design.unread}</span>
                  <h2>{destination ? <Link to={destination}>{title}</Link> : title}</h2>
                  <p>{dateTime(notice.createdAt)}</p>
                </div>
                {!notice.readAt ? (
                  <Action
                    secondary
                    pending={mark.isPending && mark.variables === notice.id}
                    onClick={() => mark.mutate(notice.id)}
                  >
                    {t.workspaceUi.markRead}
                  </Action>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
