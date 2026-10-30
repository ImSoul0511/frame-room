export type Language = 'en' | 'vi';
export const LANGUAGE_KEY = 'frameroom.language';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function createLanguageStore(storage?: PreferenceStorage) {
  let language: Language = 'en';
  try {
    const saved = storage?.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'vi') language = saved;
  } catch {
    /* Storage may be disabled by the browser. */
  }
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => language,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setLanguage(next: Language) {
      if (next !== 'en' && next !== 'vi') return;
      if (next === language) return;
      language = next;
      try {
        storage?.setItem(LANGUAGE_KEY, next);
      } catch {
        /* The selection still works for this session. */
      }
      for (const listener of listeners) listener();
    },
  };
}
let browserStorage: Storage | undefined;
try {
  if (typeof window !== 'undefined') browserStorage = window.localStorage;
} catch {
  /* Use the default when browser storage is blocked. */
}
export const languageStore = createLanguageStore(browserStorage);
export const getLanguage = languageStore.getSnapshot;
export const getLocale = () => (getLanguage() === 'vi' ? 'vi-VN' : 'en-US');
