import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Field,
  NumberField,
  Area,
  Select,
  DateField,
  FilePicker,
  Feedback,
} from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { dateTime } from '../../lib/api';
import { useDemo, useDemoTask } from './DemoContext';
import { ownsProvider } from './permissions';
import type { DemoBrief, DemoRole } from './types';

export function DemoTabs({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const namespace = useId();
  const selected = tabs.some((tab) => tab.id === value) ? value : tabs[0]?.id;
  return (
    <>
      <div
        className="workspace-tabs"
        role="tablist"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
          ];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
          onChange(tabs[next].id);
          buttons[next]?.focus();
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${namespace}-${tab.id}`}
            role="tab"
            tabIndex={selected === tab.id ? 0 : -1}
            aria-selected={selected === tab.id}
            aria-controls={`${namespace}-panel`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`${namespace}-panel`}
        aria-labelledby={`${namespace}-${selected}`}
        tabIndex={0}
        className="workspace-tab-panel"
      >
        {children}
      </section>
    </>
  );
}
export function OwnerPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const demo = useDemo();
  const t = useStrings();
  return (
    <Select label={t.demo.owner} value={value} onChange={onChange}>
      <option value={demo.role}>{t.demo.personal}</option>
      {demo.state.studios
        .filter((studio) => ownsProvider(demo.state, demo.role, studio.id))
        .map((studio) => (
          <option key={studio.id} value={studio.id}>
            {demo.text(studio.name)}
          </option>
        ))}
    </Select>
  );
}
export function localInput(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
}
export function BriefFields({
  value,
  onChange,
}: {
  value: DemoBrief;
  onChange: (value: DemoBrief) => void;
}) {
  const t = useStrings();
  const demo = useDemo();
  const task = useDemoTask();
  const set = <K extends keyof DemoBrief>(key: K, next: DemoBrief[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <Area
        label={t.demo.concept}
        value={value.concept}
        onChange={(next) => set('concept', next)}
      />
      <div className="two-col">
        <Select
          label={t.demo.genre}
          value={value.genre}
          onChange={(next) => set('genre', next as DemoBrief['genre'])}
        >
          {Object.entries(t.genreLabels).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          label={t.demo.locationType}
          value={value.locationType}
          onChange={(next) => set('locationType', next)}
        >
          {(['outdoor', 'indoor', 'studioLocation'] as const).map((key) => (
            <option key={key} value={key}>
              {t.demo[key]}
            </option>
          ))}
        </Select>
        <DateField
          label={t.demo.startTime}
          value={localInput(value.startsAt)}
          onChange={(next) => set('startsAt', next ? new Date(next).toISOString() : '')}
        />
        <DateField
          label={t.demo.endTime}
          value={localInput(value.endsAt)}
          onChange={(next) => set('endsAt', next ? new Date(next).toISOString() : '')}
        />
      </div>
      <Field
        label={t.demo.location}
        value={value.location}
        onChange={(next) => set('location', next)}
        required
      />
      <div className="workspace-number-grid">
        {(['people', 'photoCount', 'retouched', 'quota', 'revisions', 'budget'] as const).map(
          (key) => (
            <NumberField
              key={key}
              label={t.demo[key === 'photoCount' ? 'photos' : key]}
              value={value[key]}
              min={key === 'people' || key === 'photoCount' || key === 'quota' ? 1 : 0}
              onChange={(next) => set(key, next)}
            />
          ),
        )}
      </div>
      <Field label={t.demo.crew} value={value.crew} onChange={(next) => set('crew', next)} />
      <Area label={t.demo.notes} value={value.note} onChange={(next) => set('note', next)} />
      <FilePicker
        label={t.demo.references}
        onFile={(file) =>
          task.attempt(() => set('references', [...value.references, demo.file(file)]))
        }
      />
      <Feedback error={task.error} />
      <div className="workspace-files">
        {value.references.map((file) => (
          <span key={file.id}>{file.name}</span>
        ))}
      </div>
    </>
  );
}
export function BookingRows({ ids }: { ids: string[] }) {
  const demo = useDemo();
  const t = useStrings();
  return (
    <div className="workspace-list">
      {ids.map((id) => {
        const booking = demo.state.bookings.find((item) => item.id === id)!;
        return (
          <Link className="workspace-list-row" key={id} to={`/bookings/${id}`}>
            <div>
              <strong>{demo.text(booking.service.name)}</strong>
              <small>
                {demo.text(booking.providerName)} ·{' '}
                {dateTime(booking.briefs[booking.briefs.length - 1].startsAt)}
              </small>
            </div>
            <span className={`status status-${booking.status}`}>{t.statuses[booking.status]}</span>
          </Link>
        );
      })}
      {!ids.length ? <p className="empty-state">{t.demo.noResults}</p> : null}
    </div>
  );
}
export const professionalRoles: readonly DemoRole[] = ['photographer', 'photographer2', 'manager'];
