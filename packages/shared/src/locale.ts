import { z } from 'zod';
export const languageSchema = z.enum(['en', 'vi']);
export type Language = z.infer<typeof languageSchema>;
export function requestLanguage(header?: string): Language {
  const primary = header?.split(',')[0]?.split(';')[0]?.trim().toLowerCase().split('-')[0];
  return primary === 'vi' ? 'vi' : 'en';
}
