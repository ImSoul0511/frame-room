import { describe, expect, it } from 'vitest';
import { currency, dateTime } from './format';
describe('localized formatting', () => {
  it('keeps VND while switching English and Vietnamese number conventions', () => {
    expect(currency(1500000, 'en')).toContain('1,500,000');
    expect(currency(1500000, 'vi')).toContain('1.500.000');
  });
  it('uses the chosen date locale without changing the timestamp', () => {
    const at = '2026-10-30T12:00:00Z';
    expect(dateTime(at, 'en')).not.toBe(dateTime(at, 'vi'));
    expect(dateTime(at, 'en')).toContain('2026');
    expect(dateTime(at, 'vi')).toContain('2026');
  });
});
