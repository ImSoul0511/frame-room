import { Link } from 'react-router-dom';
import { useStrings } from '../../lib/i18n';
import { dateTime } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';
import { MessageAttachment } from '../booking/MessageAttachment';
import type { Message } from './types';

export function MessageBubble({
  message,
  name,
  isOwn,
  pendingStatus,
  avatarPath,
}: {
  message: Message;
  name: string;
  isOwn: boolean;
  pendingStatus?: string;
  avatarPath?: string | null;
}) {
  const t = useStrings();
  if (message.type === 'system' && !message.bookingId) {
    return (
      <article className="messenger-system-message">
        <time dateTime={message.createdAt}>{dateTime(message.createdAt)}</time>
        <p>{t.statuses[message.text as keyof typeof t.statuses] ?? message.text}</p>
        {message.bookingId ? (
          <Link to={`/bookings/${message.bookingId}`}>{t.booking.title}</Link>
        ) : null}
      </article>
    );
  }

  return (
    <article className={`messenger-message ${isOwn ? 'is-own' : ''}`}>
      <UserAvatar name={name} avatarPath={avatarPath} className="messenger-avatar" />
      <div className="messenger-message-content">
        <div className="messenger-message-meta">
          <strong>{name}</strong>
          <time dateTime={message.createdAt}>{dateTime(message.createdAt)}</time>
        </div>
        <div className="messenger-bubble">
          {message.type === 'system' ? <small>{t.messaging.bookingUpdate}</small> : null}
          {message.text ? (
            <p>
              {message.type === 'system'
                ? (t.statuses[message.text as keyof typeof t.statuses] ?? message.text)
                : message.text}
            </p>
          ) : null}
          {message.bookingId ? (
            <Link to={`/bookings/${message.bookingId}`}>{t.booking.title}</Link>
          ) : null}
          {message.storagePath ? (
            pendingStatus ? (
              <small>{t.messaging.imageAttached}</small>
            ) : (
              <MessageAttachment messageId={message.id} />
            )
          ) : null}
          {pendingStatus ? <small role="status">{pendingStatus}</small> : null}
        </div>
      </div>
    </article>
  );
}
