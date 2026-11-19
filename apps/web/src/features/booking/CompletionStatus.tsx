import type { BookingCompletion } from '@frameroom/shared';
import { dateTime } from '../../lib/api';
import { useLanguage, useStrings } from '../../lib/i18n';

export function CompletionStatus({ booking }: { booking: BookingCompletion }) {
  const t = useStrings();
  const { language } = useLanguage();

  if (booking.completionHoldAt) {
    const minutes = Math.ceil((booking.completionRemainingMs ?? 0) / 60000);
    const hoursText = new Intl.NumberFormat(language, { style: 'unit', unit: 'hour' }).format(
      Math.floor(minutes / 60),
    );
    const minutesText = new Intl.NumberFormat(language, { style: 'unit', unit: 'minute' }).format(
      minutes % 60,
    );
    return (
      <p>
        <strong>{t.booking.completionPaused}</strong> {t.booking.remainingAfterHold} {hoursText}{' '}
        {minutesText}
      </p>
    );
  }
  return booking.completionDueAt ? (
    <p>
      <strong>{t.booking.completionDue}</strong>{' '}
      <time dateTime={booking.completionDueAt}>{dateTime(booking.completionDueAt, language)}</time>
    </p>
  ) : (
    <p>{t.booking.completionUnscheduled}</p>
  );
}
