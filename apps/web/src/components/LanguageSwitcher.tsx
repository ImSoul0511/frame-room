import { Selector } from '@astryxdesign/core/Selector';
import { useLanguage, useStrings } from '../lib/i18n';
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const t = useStrings();
  return (
    <div className="language-switcher">
      <Selector
        label={t.language.label}
        isLabelHidden
        placement="below"
        variant={compact ? 'ghost' : 'input'}
        options={[
          { value: 'en', label: t.language.english },
          { value: 'vi', label: t.language.vietnamese },
        ]}
        value={language}
        onChange={(value) => setLanguage(value === 'vi' ? 'vi' : 'en')}
        controlClassName="fr-selector-control"
      />
    </div>
  );
}
