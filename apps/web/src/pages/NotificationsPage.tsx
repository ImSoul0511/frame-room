import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Feedback, PageHeading, QueryState } from '../components/ui';
import { dateTime } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { useMarkNotificationRead, type NoticePage } from '../lib/notifications';

const PAGE_SIZE = 10;
const TITLE_LIMIT = 90;

export function NotificationsPage() {
  const t = useStrings();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    unread: String(unreadOnly),
  });
  const list = useApi<NoticePage>(`/v1/me/notifications/pages?${params}`, true, 30000);
  const mark = useMarkNotificationRead();
  const notices = list.data?.items.filter((notice) => !unreadOnly || !notice.readAt) ?? [];
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
          disabled={mark.isPending}
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
            setExpandedId(null);
          }}
        >
          {t.design.allNotices}
        </button>
        <button
          className={unreadOnly ? 'chip selected' : 'chip'}
          aria-pressed={unreadOnly}
          disabled={mark.isPending}
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
            setExpandedId(null);
          }}
        >
          {t.design.unread}
        </button>
      </div>
      <QueryState
        query={list}
        empty={!unreadOnly && list.isSuccess && page === 1 && list.data.items.length === 0}
      />
      <Feedback error={mark.error} />
      {unreadOnly && list.isSuccess && !notices.length ? (
        <p className="empty-state">{t.design.noUnread}</p>
      ) : null}
      {!unreadOnly && page > 1 && list.isSuccess && !notices.length ? (
        <p className="empty-state">{t.empty}</p>
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
          const characters = Array.from(title);
          const isLong = characters.length > TITLE_LIMIT;
          const expanded = expandedId === notice.id;
          const visibleTitle =
            isLong && !expanded ? `${characters.slice(0, TITLE_LIMIT).join('')}…` : title;
          return (
            <article
              className={`notification-card ${notice.readAt ? 'is-read' : ''}`}
              key={notice.id}
            >
              <div className="row between wrap">
                <div className="notification-card-content">
                  <span className="eyebrow">{notice.readAt ? t.design.read : t.design.unread}</span>
                  <h2>
                    {destination ? <Link to={destination}>{visibleTitle}</Link> : visibleTitle}
                  </h2>
                  {isLong ? (
                    <button
                      type="button"
                      className="text-button notification-expand"
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : notice.id)}
                    >
                      {expanded ? t.design.showLess : t.design.showMore}
                    </button>
                  ) : null}
                  <p>{dateTime(notice.createdAt)}</p>
                </div>
                {!notice.readAt ? (
                  <Action
                    secondary
                    pending={mark.isPending && mark.variables === notice.id}
                    disabled={mark.isPending}
                    onClick={() =>
                      mark.mutate(notice.id, {
                        onSuccess: () => {
                          if (unreadOnly && page > 1 && notices.length === 1 && !list.data?.hasMore)
                            setPage((current) => Math.max(1, current - 1));
                        },
                      })
                    }
                  >
                    {t.workspaceUi.markRead}
                  </Action>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {page > 1 || list.data?.hasMore ? (
        <nav className="notification-pagination" aria-label={t.design.notificationPagination}>
          <Action
            secondary
            disabled={page === 1 || list.isFetching || mark.isPending}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
              setExpandedId(null);
            }}
          >
            {t.booking.previousPage}
          </Action>
          <span aria-live="polite">
            {t.design.pageLabel} {page}
          </span>
          <Action
            secondary
            disabled={!list.data?.hasMore || list.isFetching || mark.isPending}
            onClick={() => {
              setPage((current) => current + 1);
              setExpandedId(null);
            }}
          >
            {t.booking.nextPage}
          </Action>
        </nav>
      ) : null}
    </>
  );
}
