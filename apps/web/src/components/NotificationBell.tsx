import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/hooks';
import { useStrings } from '../lib/i18n';

export type Notice = {
  id: string;
  bookingId: string | null;
  studioId: string | null;
  event: string;
  createdAt: string;
  readAt: string | null;
};
export function NotificationBell() {
  const t = useStrings();
  const { profile } = useAuth();
  const notices = useApi<Notice[]>('/v1/me/notifications', Boolean(profile), 30000);
  const count = notices.data?.filter((notice) => !notice.readAt).length ?? 0;
  return (
    <Link
      className="notification-bell"
      to="/notifications"
      aria-label={`${t.workspaceUi.notifications}${count ? ` (${count})` : ''}`}
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
      {count ? <span className="notification-count">{count > 99 ? '99+' : count}</span> : null}
    </Link>
  );
}
