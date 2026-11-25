import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Booking } from '@frameroom/shared';
import { useAuth } from '../../lib/auth';
import { useApi, useTask } from '../../lib/hooks';
import { useLanguage, useStrings } from '../../lib/i18n';
import { api, dateTime } from '../../lib/api';
import { Action, Feedback, QueryState, Status } from '../../components/ui';
import { UnavailableTimeForm } from './UnavailableTimeForm';

type Block = {
  id: string;
  label: string;
  bookingId: string | null;
  startsAt: string;
  endsAt: string;
};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function overlaps(start: string, end: string, day: Date) {
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return Date.parse(start) < next.getTime() && Date.parse(end) > day.getTime();
}
export function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  const t = useStrings();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const personal = profile?.roles.includes('photographer') ?? false;
  const manager = profile?.roles.includes('studio_manager') ?? false;
  const professional = personal || manager;
  const remove = useTask((id: string) => api(`/v1/me/schedule/blocks/${id}`, { method: 'DELETE' }));
  const blocks = useApi<Block[]>('/v1/me/schedule', professional, 30000);
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const today = dateKey(new Date());
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((offset + total) / 7);
  const available = bookings.filter(
    (booking) => !['cancelled', 'rejected'].includes(booking.status),
  );
  const busy = blocks.data?.filter((block) => !block.bookingId) ?? [];
  const day = new Date(`${selected}T00:00:00`);
  const shoots = available.filter((booking) =>
    overlaps(booking.scheduledStart, booking.scheduledEnd, day),
  );
  const dayBlocks = busy.filter((block) => overlaps(block.startsAt, block.endsAt, day));
  const changeMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelected(dateKey(next));
  };
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB';
  return (
    <section className="calendar-panel" aria-labelledby="calendar-title">
      <header className="calendar-heading">
        <div>
          <p className="eyebrow">{t.design.calendar}</p>
          <h2 id="calendar-title">
            {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}
          </h2>
        </div>
        <div className="row">
          <button
            className="text-button"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelected(dateKey(now));
            }}
          >
            {t.design.today}
          </button>
          <button
            className="calendar-step"
            aria-label={t.design.previousMonth}
            onClick={() => changeMonth(-1)}
          >
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="m12 4-6 6 6 6" />
            </svg>
          </button>
          <button
            className="calendar-step"
            aria-label={t.design.nextMonth}
            onClick={() => changeMonth(1)}
          >
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="m8 4 6 6-6 6" />
            </svg>
          </button>
        </div>
      </header>
      <div className="calendar-layout">
        <table className="month-calendar">
          <caption className="sr-only">{t.design.calendarDescription}</caption>
          <thead>
            <tr>
              {Array.from({ length: 7 }, (_, index) => (
                <th scope="col" key={index}>
                  {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
                    new Date(2024, 0, 1 + index),
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weeks }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, weekday) => {
                  const number = week * 7 + weekday - offset + 1;
                  if (number < 1 || number > total) return <td key={weekday} />;
                  const date = new Date(month.getFullYear(), month.getMonth(), number);
                  const key = dateKey(date);
                  const events = available.filter((booking) =>
                    overlaps(booking.scheduledStart, booking.scheduledEnd, date),
                  );
                  const blocked = busy.some((block) =>
                    overlaps(block.startsAt, block.endsAt, date),
                  );
                  return (
                    <td key={weekday}>
                      <button
                        className={`calendar-day ${key === today ? 'is-today' : ''}`}
                        aria-pressed={selected === key}
                        aria-current={key === today ? 'date' : undefined}
                        aria-label={`${new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)}${events.length ? `, ${events.length} ${t.workspaceUi.bookings}` : ''}${blocked ? `, ${t.design.busy}` : ''}`}
                        onClick={() => setSelected(key)}
                      >
                        <span>{number}</span>
                        <span className="calendar-markers" aria-hidden="true">
                          {events.length ? <i className="shoot-marker">{events.length}</i> : null}
                          {blocked ? <i className="busy-marker" /> : null}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <aside className="calendar-agenda" aria-live="polite">
          <h3>
            {new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(day)}
          </h3>
          {professional ? <QueryState query={blocks} /> : null}
          <Feedback error={remove.error} />
          {!shoots.length && !dayBlocks.length && (!professional || blocks.isSuccess) ? (
            <p className="muted">{t.design.noEvents}</p>
          ) : null}
          {shoots.map((booking) => (
            <Link className="agenda-event" key={booking.id} to={`/bookings/${booking.id}`}>
              <strong>{booking.serviceName}</strong>
              <span>{dateTime(booking.scheduledStart)}</span>
              <Status status={booking.status} />
            </Link>
          ))}
          {dayBlocks.map((block) => (
            <div className="agenda-event busy-event" key={block.id}>
              <strong>{block.label || t.design.busy}</strong>
              <span>
                {dateTime(block.startsAt)} – {dateTime(block.endsAt)}
              </span>
              <Action
                secondary
                disabled={remove.isPending}
                pending={remove.isPending && remove.variables === block.id}
                onClick={() => remove.mutate(block.id)}
              >
                {t.delete}
              </Action>
            </div>
          ))}
          {professional ? (
            <Action secondary onClick={() => setCreatingBlock(true)}>
              {t.studio.newBlock}
            </Action>
          ) : null}
        </aside>
      </div>
      <div className="calendar-legend">
        <span>
          <i className="shoot-marker" />
          {t.workspaceUi.bookings}
        </span>
        <span>
          <i className="busy-marker" />
          {t.design.busy}
        </span>
      </div>
      {creatingBlock ? (
        <UnavailableTimeForm
          date={selected}
          personal={personal}
          manager={manager}
          onClose={() => setCreatingBlock(false)}
        />
      ) : null}
    </section>
  );
}
