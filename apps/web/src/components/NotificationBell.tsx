import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import { useMarkNotificationRead, type Notice } from '../lib/notifications';
import { Feedback } from './ui';

export function NotificationBell() {
  const t = useStrings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const notices = useApi<Notice[]>('/v1/me/notifications', Boolean(profile), 30000);
  const mark = useMarkNotificationRead();
  const count = notices.data?.filter((notice) => !notice.readAt).length ?? 0;
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  return (
    <div className="notification-dropdown" ref={container}>
      <button
        ref={trigger}
        type="button"
        className="notification-bell"
        aria-label={`${t.workspaceUi.notifications}${count ? ` (${count} ${t.design.unread})` : ''}`}
        aria-expanded={open}
        aria-controls="notification-preview"
        onClick={() => {
          if (!profile) navigate('/auth?next=%2Fnotifications');
          else setOpen((value) => !value);
        }}
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
        </svg>
        {count ? <span className="notification-unread-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <section
          id="notification-preview"
          className="notification-preview"
          aria-label={t.workspaceUi.notifications}
        >
          <div className="notification-preview-header">
            <strong>{t.workspaceUi.notifications}</strong>
            <Link to="/notifications" onClick={() => setOpen(false)}>
              {t.design.allNotices}
            </Link>
          </div>
          <div className="notification-preview-list">
            {notices.isPending ? <p role="status">{t.pending}</p> : null}
            {notices.error ? <Feedback error={notices.error} /> : null}
            {notices.isSuccess && !notices.data.length ? <p>{t.empty}</p> : null}
            {notices.data?.slice(0, 5).map((notice) => (
              <button
                key={notice.id}
                type="button"
                className={`notification-preview-item ${notice.readAt ? '' : 'is-unread'}`}
                disabled={mark.isPending}
                onClick={async () => {
                  try {
                    if (!notice.readAt) await mark.mutateAsync(notice.id);
                    setOpen(false);
                    navigate('/notifications');
                  } catch {
                    // The mutation restores the unread state and displays its error below.
                  }
                }}
              >
                <span className="notification-preview-dot" aria-hidden="true" />
                <span>
                  <strong>
                    {t.workspaceUi[notice.event as keyof typeof t.workspaceUi] ??
                      t.workspaceUi.notifications}
                  </strong>
                  <small>
                    {dateTime(notice.createdAt)} · {notice.readAt ? t.design.read : t.design.unread}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <Feedback error={mark.error} />
        </section>
      ) : null}
    </div>
  );
}
