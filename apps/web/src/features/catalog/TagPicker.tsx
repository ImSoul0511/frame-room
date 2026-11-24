import { useState } from 'react';
import type { Tag } from '../../lib/types';
import { useLanguage, useStrings } from '../../lib/i18n';

export function TagPicker({
  tags,
  selected,
  onChange,
  disabled = false,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const t = useStrings();
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const label = (tag: Tag) => (language === 'vi' ? tag.nameVi || tag.name : tag.name);
  const matches = tags.filter((tag) =>
    ` ${label(tag)} ${tag.name} ${tag.slug}`
      .toLocaleLowerCase(language)
      .includes(search.trim().toLocaleLowerCase(language)),
  );
  const categories = [...new Set(matches.map((tag) => tag.category || tag.kind))];
  return (
    <fieldset className="tag-picker" disabled={disabled}>
      <legend>
        {t.design.allTags} · {selected.length}/20
      </legend>
      <label className="native-field">
        <span>{t.design.searchTags}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={80}
        />
      </label>
      <div className="tag-picker-groups">
        {categories.map((category) => (
          <details key={category} open={Boolean(search) || undefined}>
            <summary>
              {t.design.tagCategories[category as keyof typeof t.design.tagCategories] ?? category}{' '}
              <small>
                (
                {
                  matches.filter(
                    (tag) => (tag.category || tag.kind) === category && selected.includes(tag.id),
                  ).length
                }
                )
              </small>
            </summary>
            {matches
              .filter((tag) => (tag.category || tag.kind) === category)
              .map((tag) => (
                <label key={tag.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(tag.id)}
                    disabled={selected.length >= 20 && !selected.includes(tag.id)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...selected, tag.id]
                          : selected.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  {label(tag)}
                </label>
              ))}
          </details>
        ))}
      </div>
    </fieldset>
  );
}
