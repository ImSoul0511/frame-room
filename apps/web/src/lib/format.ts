import { strings } from '../strings';
import { getLanguage, type Language } from './locale-store';
export function currency(value: number | null, language: Language = getLanguage()) {
  return value === null
    ? strings.contactPrice
    : new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(value);
}
export function dateTime(value: string, language: Language = getLanguage()) {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
