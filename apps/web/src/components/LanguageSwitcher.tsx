import { useId } from 'react';
import { useLanguage, useStrings } from '../lib/i18n';
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const t = useStrings();
  const id = useId();
  return (
    <div className="language-switcher">
      <label htmlFor={id}>{t.language.label}</label>
      <select
        id={id}
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'vi' ? 'vi' : 'en')}
      >
        <option value="en" lang="en">
          {t.language.english}
        </option>
        <option value="vi" lang="vi">
          {t.language.vietnamese}
        </option>
      </select>
    </div>
  );
}
