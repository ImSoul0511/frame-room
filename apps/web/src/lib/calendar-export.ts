export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  url?: string;
  sequence?: number;
}
function text(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
function stamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (bytes + length > 75) {
      parts.push(current);
      current = ' ';
      bytes = 1;
    }
    current += char;
    bytes += length;
  }
  parts.push(current);
  return parts.join('\r\n');
}
export function buildCalendar(events: CalendarEvent[], now: Date) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FrameRoom//Shoot Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${text(event.id)}@frameroom`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(new Date(event.start))}`,
      `DTEND:${stamp(new Date(event.end))}`,
      `SUMMARY:${text(event.title)}`,
      `DESCRIPTION:${text(event.description ?? '')}`,
      `STATUS:${event.status ?? 'CONFIRMED'}`,
      `SEQUENCE:${Math.max(0, Math.trunc(event.sequence ?? 0))}`,
    );
    if (event.url) {
      const url = new URL(event.url);
      if (['http:', 'https:'].includes(url.protocol)) lines.push(`URL:${url.href}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
