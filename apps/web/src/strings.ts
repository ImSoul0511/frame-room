import { english } from './locales/en';
import { vietnamese } from './locales/vi';
import { getLanguage } from './lib/locale-store';

// For non-React utilities. Components subscribe with useStrings() instead.
export const strings: typeof english = new Proxy(english, {
  get(_target, key: keyof typeof english) {
    return (getLanguage() === 'vi' ? vietnamese : english)[key];
  },
});
