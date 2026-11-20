import { Link } from 'react-router-dom';
import type { ShootCalendar } from '@frameroom/shared';
import { dateTime } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import { Status } from '../../components/ui';
export function CalendarAgenda({ bookings, blocks }: ShootCalendar) {
  const t = useStrings();
  const items = [
    ...bookings.map((booking) => ({
      id: booking.id,
      title: booking.serviceName,
      start: booking.scheduledStart,
      end: booking.scheduledEnd,
      status: booking.status,
      to: `/bookings/${booking.id}`,
    })),
    ...blocks.map((block) => ({
      id: block.id,
      title: block.label || t.tools.availability,
      start: block.startsAt,
      end: block.endsAt,
      status: null,
      to: '/settings',
    })),
  ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (!items.length) return <p className="calendar-empty">{t.tools.noEvents}</p>;
  return (
    <div className="calendar-agenda">
      {items.map((item) => (
        <Link
          className={`calendar-agenda-item ${item.status ? '' : 'is-block'}`}
          to={item.to}
          key={item.id}
        >
          <span>
            <strong>{item.title}</strong>
            <small>
              {dateTime(item.start)} — {dateTime(item.end)}
            </small>
          </span>
          {item.status ? (
            <Status status={item.status} />
          ) : (
            <span className="eyebrow">{t.tools.availability}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
