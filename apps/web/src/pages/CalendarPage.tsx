import { useEffect, useRef, useState } from 'react';
import type { ShootCalendar } from '@frameroom/shared';
import { Action, PageHeading, QueryState } from '../components/ui';
import { useApi } from '../lib/hooks';
import { useLanguage, useStrings } from '../lib/i18n';
import { buildCalendar, type CalendarEvent } from '../lib/calendar-export';
import { downloadText } from '../lib/download';
import { addDays, dayKey, monthGrid, monthStart, overlapsDay } from '../features/calendar/dates';
import { CalendarAgenda } from '../features/calendar/CalendarAgenda';

export function CalendarPage() {
  const t = useStrings();
  const { language } = useLanguage();
  const [today, setToday] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthStart(today));
  const [selected, setSelected] = useState(() => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    return day;
  });
  const [view, setView] = useState('month');
  const [filter, setFilter] = useState('active');
  const grid = useRef<HTMLDivElement>(null);
  const focusRequested = useRef(false);
  const days = monthGrid(month);
  const range = new URLSearchParams({
    from: days[0]!.toISOString(),
    to: addDays(days[41]!, 1).toISOString(),
  });
  const calendar = useApi<ShootCalendar>(`/v1/me/calendar?${range}`, true, 60000);
  const bookings = (calendar.data?.bookings ?? []).filter(
    (booking) =>
      filter === 'all' ||
      ['pending', 'confirmed', 'in_progress', 'proofing', 'delivered'].includes(booking.status),
  );
  const blocks = calendar.data?.blocks ?? [];
  const selectedBookings = bookings.filter((booking) =>
    overlapsDay(booking.scheduledStart, booking.scheduledEnd, selected),
  );
  const selectedBlocks = blocks.filter((block) =>
    overlapsDay(block.startsAt, block.endsAt, selected),
  );
  const fullDate = (date: Date) =>
    new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(date);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (focusRequested.current) {
      grid.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(selected)}"]`)?.focus();
      focusRequested.current = false;
    }
  }, [selected]);
  const changeMonth = (offset: number) => {
    const next = monthStart(month);
    next.setMonth(next.getMonth() + offset);
    setMonth(next);
    setSelected(next);
  };
  const exportCalendar = () => {
    const events: CalendarEvent[] = [
      ...bookings.map((booking) => ({
        id: booking.id,
        title: booking.serviceName,
        start: booking.scheduledStart,
        end: booking.scheduledEnd,
        description: t.statuses[booking.status],
        status:
          booking.status === 'cancelled' || booking.status === 'rejected'
            ? ('CANCELLED' as const)
            : booking.status === 'pending'
              ? ('TENTATIVE' as const)
              : ('CONFIRMED' as const),
        sequence: booking.version,
        url: `${window.location.origin}/bookings/${booking.id}`,
      })),
      ...blocks.map((block) => ({
        id: block.id,
        title: block.label || t.tools.availability,
        start: block.startsAt,
        end: block.endsAt,
      })),
    ];
    downloadText(
      `FrameRoom-${dayKey(month).slice(0, 7)}.ics`,
      buildCalendar(events, new Date()),
      'text/calendar;charset=utf-8',
    );
  };
  return (
    <>
      <PageHeading
        title={t.tools.calendar}
        subtitle={t.tools.calendarHint}
        action={
          <Action secondary disabled={!calendar.data || calendar.isError} onClick={exportCalendar}>
            {t.tools.exportCalendar}
          </Action>
        }
      />
      <div className="calendar-toolbar">
        <div className="row wrap">
          <button
            className="calendar-arrow"
            aria-label={t.tools.previousMonth}
            onClick={() => changeMonth(-1)}
          >
            ←
          </button>
          <label className="calendar-month-input">
            <span className="sr-only">{t.tools.month}</span>
            <input
              type="month"
              value={dayKey(month).slice(0, 7)}
              onChange={(event) => {
                if (event.target.value) {
                  const next = new Date(`${event.target.value}-01T00:00:00`);
                  setMonth(next);
                  setSelected(next);
                }
              }}
            />
          </label>
          <button
            className="calendar-arrow"
            aria-label={t.tools.nextMonth}
            onClick={() => changeMonth(1)}
          >
            →
          </button>
          <Action
            secondary
            onClick={() => {
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              setMonth(monthStart(now));
              setSelected(now);
              setToday(now);
            }}
          >
            {t.tools.today}
          </Action>
        </div>
        <div className="row wrap">
          {(['month', 'agenda'] as const).map((key) => (
            <button
              key={key}
              className="chip"
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {t.tools[key]}
            </button>
          ))}
          {(['active', 'all'] as const).map((key) => (
            <button
              key={key}
              className="chip"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {key === 'all' ? t.tools.allShoots : t.tools.activeOnly}
            </button>
          ))}
        </div>
      </div>
      <QueryState query={calendar} />
      <p className="calendar-timezone">
        {t.tools.timezone} {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      {view === 'month' ? (
        <div className="calendar-layout">
          <div className="calendar-month">
            <h2 id="calendar-month-title">
              {new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(month)}
            </h2>
            <div
              role="grid"
              aria-labelledby="calendar-month-title"
              ref={grid}
              onKeyDown={(event) => {
                const offsets: Record<string, number> = {
                  ArrowRight: 1,
                  ArrowLeft: -1,
                  ArrowDown: 7,
                  ArrowUp: -7,
                };
                const offset = offsets[event.key];
                if (offset === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
                event.preventDefault();
                const next = addDays(selected, offset);
                focusRequested.current = true;
                setSelected(next);
                if (
                  next.getMonth() !== month.getMonth() ||
                  next.getFullYear() !== month.getFullYear()
                )
                  setMonth(monthStart(next));
              }}
            >
              <div role="row" className="calendar-weekdays">
                {Array.from({ length: 7 }, (_, index) => (
                  <span role="columnheader" key={index}>
                    {new Intl.DateTimeFormat(language, { weekday: 'short' }).format(
                      addDays(new Date(2024, 0, 1), index),
                    )}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, week) => (
                <div role="row" className="calendar-week" key={week}>
                  {days.slice(week * 7, week * 7 + 7).map((day) => {
                    const count =
                      bookings.filter((booking) =>
                        overlapsDay(booking.scheduledStart, booking.scheduledEnd, day),
                      ).length +
                      blocks.filter((block) => overlapsDay(block.startsAt, block.endsAt, day))
                        .length;
                    const active = dayKey(selected) === dayKey(day);
                    return (
                      <div role="gridcell" aria-selected={active} key={dayKey(day)}>
                        <button
                          data-day={dayKey(day)}
                          className={`calendar-day ${active ? 'is-selected' : ''} ${day.getMonth() !== month.getMonth() ? 'outside-month' : ''}`}
                          aria-label={`${fullDate(day)}: ${count}`}
                          aria-current={dayKey(today) === dayKey(day) ? 'date' : undefined}
                          tabIndex={active ? 0 : -1}
                          onClick={() => {
                            if (day.getMonth() !== month.getMonth()) {
                              focusRequested.current = true;
                              setMonth(monthStart(day));
                            }
                            setSelected(day);
                          }}
                        >
                          <span>{day.getDate()}</span>
                          {count ? <small className="calendar-day-count">{count}</small> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <section className="calendar-day-detail" aria-label={t.tools.selectedDay}>
            <p className="eyebrow">{t.tools.selectedDay}</p>
            <h3>{fullDate(selected)}</h3>
            <CalendarAgenda bookings={selectedBookings} blocks={selectedBlocks} />
          </section>
        </div>
      ) : (
        <CalendarAgenda bookings={bookings} blocks={blocks} />
      )}
    </>
  );
}
