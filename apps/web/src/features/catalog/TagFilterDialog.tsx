import { useState } from 'react';
import { Modal, QueryState } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { useLanguage, useStrings } from '../../lib/i18n';
import type { Tag } from '../../lib/types';

export function TagFilterDialog({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const t = useStrings();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const tags = useApi<Tag[]>('/v1/tags', open, undefined, 300_000);
  const secondary = (tags.data ?? []).filter((tag) => tag.category !== 'genre');
  const categories = [...new Set(secondary.map((tag) => tag.category || tag.kind))];
  return (
    <>
      <button
        type="button"
        className="tag-filter-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t.design.filterTags}
        {selected.length ? ` · ${selected.length}` : ''}
      </button>
      {open && (
        <Modal title={t.design.filterTags} onClose={() => setOpen(false)}>
          <div className="tag-filter-content">
            <button
              type="button"
              className={!selected.length ? 'chip selected' : 'chip'}
              aria-pressed={!selected.length}
              onClick={() => onChange([])}
            >
              {t.all}
            </button>
            {categories.map((category) => (
              <fieldset key={category}>
                <legend>
                  {t.design.tagCategories[category as keyof typeof t.design.tagCategories] ??
                    category}
                </legend>
                <div className="genre-chips">
                  {secondary
                    .filter((tag) => (tag.category || tag.kind) === category)
                    .map((tag) => (
                      <button
                        type="button"
                        key={tag.id}
                        className={selected.includes(tag.slug) ? 'chip selected' : 'chip'}
                        aria-pressed={selected.includes(tag.slug)}
                        disabled={selected.length >= 10 && !selected.includes(tag.slug)}
                        onClick={() =>
                          onChange(
                            selected.includes(tag.slug)
                              ? selected.filter((slug) => slug !== tag.slug)
                              : [...selected, tag.slug],
                          )
                        }
                      >
                        {language === 'vi' ? tag.nameVi || tag.name : tag.name}
                      </button>
                    ))}
                </div>
              </fieldset>
            ))}
            <QueryState query={tags} />
          </div>
          <button type="button" className="button-link dark" onClick={() => setOpen(false)}>
            {t.close}
          </button>
        </Modal>
      )}
    </>
  );
}
