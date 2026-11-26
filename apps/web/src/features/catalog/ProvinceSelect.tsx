import { Selector } from '@astryxdesign/core/Selector';
import { findVietnamLocality, vietnamLocalities } from '@frameroom/shared';
import { useLanguage, useStrings } from '../../lib/i18n';

export function ProvinceSelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const t = useStrings();
  const { language } = useLanguage();
  const canonical = findVietnamLocality(value)?.name;
  return (
    <div className="fr-selector-field province-field">
      <Selector
        label={t.curation.city}
        placement="below"
        options={[
          { value: '', label: required ? t.curation.cityPlaceholder : t.all },
          ...vietnamLocalities.map(({ name, english }) => ({
            value: name,
            label:
              language === 'vi'
                ? english !== name
                  ? `${name} · ${english}`
                  : name
                : `${english} · ${name}`,
          })),
        ]}
        value={canonical ?? ''}
        onChange={onChange}
        hasSearch
        searchPlaceholder={t.curation.cityPlaceholder}
        emptySearchText={t.explore.noResults}
        controlClassName="fr-selector-control"
        width="100%"
      />
    </div>
  );
}
