import { expect, it } from 'vitest';
import { buildCalendar } from './calendar-export';
it('exports stable event IDs, UTC times, statuses and escaped text without injected properties', () => {
  const content = buildCalendar(
    [
      {
        id: 'shoot-one',
        title: 'Portrait; outdoors, again\r\nBEGIN:VEVENT',
        start: '2026-11-20T15:00:00+07:00',
        end: '2026-11-20T16:00:00+07:00',
        status: 'CANCELLED',
        sequence: 3,
      },
    ],
    new Date('2026-11-19T00:00:00Z'),
  );
  expect(content).toContain('DTSTART:20261120T080000Z\r\n');
  expect(content).toContain('UID:shoot-one@frameroom');
  expect(content).toContain('SUMMARY:Portrait\\; outdoors\\, again\\nBEGIN:VEVENT');
  expect(content.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
  expect(content).toContain('STATUS:CANCELLED\r\nSEQUENCE:3');
});
it('folds UTF-8 by bytes while preserving international text', () => {
  const title = 'Một khung hình đáng giữ. '.repeat(12);
  const content = buildCalendar(
    [{ id: 'one', title, start: '2026-11-20T08:00:00Z', end: '2026-11-20T09:00:00Z' }],
    new Date('2026-11-19T00:00:00Z'),
  );
  for (const line of content.split('\r\n'))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(content.replace(/\r\n /g, '')).toContain(`SUMMARY:${title}`);
});
