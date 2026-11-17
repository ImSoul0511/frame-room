import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { categoryNames, s } from './strings';
import type { Tag } from './types';

const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  image:
    'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M3 17l6-6 4 4 3-3 5 5 M15 7h.01',
  tag: 'M3 3h8l10 10-8 8L3 11z M7 7h.01',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  edit: 'M14 4l6 6 M4 14L16 2l6 6-12 12-7 1z',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12 M18 6L6 18',
  refresh: 'M20 7V3l-4 4 M4 17v4l4-4 M20 7a8 8 0 0 0-14-2 M4 17a8 8 0 0 0 14 2',
  folder: 'M3 7V4h7l3 3h8v13H3z',
  up: 'M6 14l6-6 6 6',
  down: 'M6 10l6 6 6-6',
};
export const DialogFeedback = createContext<string | null>(null);
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const error = useContext(DialogFeedback);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <dialog
      ref={ref}
      className={`studio-modal ${wide ? 'wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <Button
          label={s.close}
          variant="ghost"
          size="sm"
          isIconOnly
          icon={<Icon name="close" />}
          isDisabled={busy}
          onClick={close}
        />
      </header>
      {error && (
        <div className="modal-error" role="alert">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}
export function Area({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} />
    </label>
  );
}
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="image" size={28} />
      </div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}
export function TagPicker({
  tags,
  selected,
  onChange,
  includeInactive = false,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
  includeInactive?: boolean;
}) {
  const [query, setQuery] = useState('');
  const needle = query.toLocaleLowerCase();
  const filtered = tags.filter(
    (tag) =>
      (tag.is_active || includeInactive || selected.includes(tag.id)) &&
      [tag.name, tag.name_vi, tag.slug, tag.definition_vi, ...tag.aliases]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle),
  );
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return (
    <div className="tag-picker">
      <TextInput
        label={s.searchTags}
        isLabelHidden
        placeholder={s.searchTags}
        value={query}
        onChange={setQuery}
        hasClear
      />
      <p className="field-hint">{s.tagHelp}</p>
      <div className="tag-picker-groups">
        {Object.entries(categoryNames).map(([category, name]) => {
          const items = filtered.filter((tag) => tag.category === category);
          return items.length ? (
            <section className="tag-group" key={category}>
              <h4>
                {name}
                <span>{items.length}</span>
              </h4>
              <div className="tag-cloud">
                {items.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    className={`tag-option ${selected.includes(tag.id) ? 'selected' : ''}`}
                    title={tag.definition_vi || tag.definition_en || tag.name}
                    aria-pressed={selected.includes(tag.id)}
                    onClick={() => toggle(tag.id)}
                  >
                    {selected.includes(tag.id) && <Icon name="check" size={12} />}
                    {tag.name_vi || tag.name}
                    {!tag.is_active && <small>{s.inactive}</small>}
                  </button>
                ))}
              </div>
            </section>
          ) : null;
        })}
        {!filtered.length && <p className="field-hint">{s.noTags}</p>}
      </div>
    </div>
  );
}
