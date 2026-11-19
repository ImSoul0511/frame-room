import { useEffect, useSyncExternalStore } from 'react';
import { english } from '../locales/en';
import { vietnamese } from '../locales/vi';
import { languageStore, type Language } from './locale-store';

export type Translations = typeof english;
export const translations: Record<Language, Translations> = { en: english, vi: vietnamese };
export function useLanguage() {
  const language = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.getSnapshot,
    () => 'en' as const,
  );
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return { language, setLanguage: languageStore.setLanguage };
}
export function useStrings(): Translations {
  return translations[useLanguage().language];
}
