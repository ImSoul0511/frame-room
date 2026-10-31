import { useId, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { genres } from '@frameroom/shared';
import { useStrings } from '../lib/i18n';

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const t = useStrings();
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">
          {t.eyebrow} / {t.personal}
        </p>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
export function Action({
  children,
  onClick,
  pending = false,
  disabled = false,
  type = 'button',
  secondary = false,
}: {
  children: string;
  onClick?: () => void;
  pending?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  secondary?: boolean;
}) {
  return (
    <Button
      label={children}
      onClick={onClick}
      type={type}
      isLoading={pending}
      isDisabled={disabled || pending}
      variant={secondary ? 'secondary' : 'primary'}
    />
  );
}
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password';
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={onChange}
      type={type}
      isRequired={required}
      placeholder={placeholder}
      autoComplete={
        type === 'email' ? 'email' : type === 'password' ? 'current-password' : undefined
      }
      width="100%"
    />
  );
}
export function Area({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return <TextArea label={label} value={value} onChange={onChange} placeholder={placeholder} />;
}
export function Select({
  label,
  value,
  onChange,
  children,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="native-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        {children}
      </select>
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const id = useId();
  return (
    <div className="native-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
      />
    </div>
  );
}
export function DateField({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="native-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="datetime-local"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function GenreSelect({
  value,
  onChange,
  allowAll = false,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  const t = useStrings();
  return (
    <Select label={t.portfolio.genre} value={value} onChange={onChange}>
      {allowAll ? <option value="">{t.all}</option> : null}
      {genres.map((g) => (
        <option key={g} value={g}>
          {t.genreLabels[g]}
        </option>
      ))}
    </Select>
  );
}
export function Feedback({ error, success }: { error?: Error | null; success?: string | null }) {
  const t = useStrings();
  if (error)
    return (
      <div role="alert" className="notice error">
        {error.name === 'ZodError' ? t.errors.invalid_input : error.message}
      </div>
    );
  if (success)
    return (
      <div role="status" className="notice success">
        {success}
      </div>
    );
  return null;
}
export function QueryState({
  query,
  empty = false,
}: {
  query: { isPending: boolean; error: Error | null; refetch: () => unknown };
  empty?: boolean;
}) {
  const t = useStrings();
  if (query.isPending)
    return (
      <div className="loading" role="status">
        <span className="loading-dot" />
        {t.pending}
      </div>
    );
  if (query.error)
    return (
      <div className="notice error" role="alert">
        {query.error.message}
        <Action secondary onClick={() => void query.refetch()}>
          {t.retry}
        </Action>
      </div>
    );
  if (empty)
    return (
      <div className="empty-state">
        <span className="empty-mark">◎</span>
        <p>{t.empty}</p>
      </div>
    );
  return null;
}
export function FilePicker({
  label,
  onFile,
  disabled = false,
  multiple = false,
}: {
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const id = useId();
  return (
    <div className="file-picker">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          for (const file of files) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
export function Form({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  return (
    <form
      className="form-stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
export function Status({ status }: { status: string }) {
  const t = useStrings();
  return (
    <span className={`status status-${status}`}>
      {t.statuses[status as keyof typeof t.statuses] ??
        t.project[status as keyof typeof t.project] ??
        status}
    </span>
  );
}
export function Provenance({ value }: { value: string }) {
  const t = useStrings();
  return value === 'captured' ? null : (
    <span className="provenance">
      ✧ {value === 'ai_generated' ? t.project.aiGenerated : t.project.manipulated}
    </span>
  );
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useStrings();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby={id} className="modal">
      <div className="row between">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
