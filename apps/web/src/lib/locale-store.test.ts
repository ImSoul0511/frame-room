import { describe, expect, it, vi } from 'vitest';
import { createLanguageStore, LANGUAGE_KEY } from './locale-store';
import { english } from '../locales/en';
import { vietnamese } from '../locales/vi';

describe('language preference', () => {
  it('defaults to English without a saved preference', () => {
    expect(createLanguageStore().getSnapshot()).toBe('en');
  });
  it('restores Vietnamese and persists a switch to English', () => {
    const storage = { getItem: vi.fn(() => 'vi'), setItem: vi.fn() };
    const store = createLanguageStore(storage);
    const changed = vi.fn();
    const unsubscribe = store.subscribe(changed);
    expect(store.getSnapshot()).toBe('vi');
    store.setLanguage('en');
    expect(storage.setItem).toHaveBeenCalledWith(LANGUAGE_KEY, 'en');
    expect(changed).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setLanguage('vi');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(createLanguageStore({ getItem: () => 'en', setItem: vi.fn() }).getSnapshot()).toBe('en');
  });
  it('handles invalid saved values and blocked storage', () => {
    expect(createLanguageStore({ getItem: () => 'fr', setItem: vi.fn() }).getSnapshot()).toBe('en');
    const store = createLanguageStore({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(store.getSnapshot()).toBe('en');
    store.setLanguage('vi');
    expect(store.getSnapshot()).toBe('vi');
  });
  it('keeps complete translation keys in both languages', () => {
    function keys(value: object, prefix = ''): string[] {
      return Object.entries(value)
        .flatMap(([key, item]) =>
          typeof item === 'object' ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`],
        )
        .sort();
    }
    expect(keys(english)).toEqual(keys(vietnamese));
  });
});
