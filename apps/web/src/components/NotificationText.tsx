import type { ReactNode } from 'react';
import { dateTime } from '../lib/api';
import { useStrings } from '../lib/i18n';
import type { Notice } from '../lib/notifications';

export function useNotificationTitle() {
  const { workspaceUi } = useStrings();
  return (notice: Notice) =>
    workspaceUi[notice.event as keyof typeof workspaceUi] ?? workspaceUi.notifications;
}

export function NotificationText({
  notice,
  title,
  heading = false,
}: {
  notice: Notice;
  title: ReactNode;
  heading?: boolean;
}) {
  const t = useStrings();
  const Title = heading ? 'h2' : 'strong';
  const Container = heading ? 'div' : 'span';
  return (
    <Container className="notification-text">
      <Title>{title}</Title>
      <small>
        {dateTime(notice.createdAt)} · {notice.readAt ? t.design.read : t.design.unread}
      </small>
    </Container>
  );
}
