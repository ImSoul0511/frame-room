import { useState } from 'react';
import { briefContentSchema, type BriefContent } from '@frameroom/shared';
import {
  Action,
  Area,
  DateField,
  Feedback,
  Field,
  Form,
  GenreSelect,
  NumberField,
  Select,
} from '../../components/ui';
import { useStrings } from '../../lib/i18n';

export function BriefEditor({
  initial,
  onSave,
  pending = false,
  error,
}: {
  initial: BriefContent;
  onSave: (value: BriefContent) => void;
  pending?: boolean;
  error?: Error | null;
}) {
  const t = useStrings();
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  return (
    <Form
      onSubmit={() => {
        const result = briefContentSchema.safeParse(value);
        setInvalid(!result.success);
        if (result.success) onSave(result.data);
      }}
    >
      <Field
        label={t.project.name}
        value={value.title}
        onChange={(title) => setValue({ ...value, title })}
        required
      />
      <Area
        label={t.project.concept}
        value={value.concept}
        onChange={(concept) => setValue({ ...value, concept })}
      />
      {value.requirements ? (
        <ScopeFields
          value={value.requirements}
          onChange={(requirements) => setValue({ ...value, requirements })}
        />
      ) : null}
      {(['shotList', 'lighting', 'checklist', 'milestones'] as const).map((key) => (
        <Area
          key={key}
          label={`${t.project[key]} · ${t.project.onePerLine}`}
          value={value[key].join('\n')}
          onChange={(text) => setValue({ ...value, [key]: text.split('\n') })}
        />
      ))}
      <Feedback error={error ?? (invalid ? new Error(t.errors.invalid_input) : null)} />
      <Action type="submit" pending={pending}>
        {t.project.applyPlan}
      </Action>
    </Form>
  );
}

type Scope = NonNullable<BriefContent['requirements']>;
function ScopeFields({ value, onChange }: { value: Scope; onChange: (value: Scope) => void }) {
  const t = useStrings();
  const change = <Key extends keyof Scope>(key: Key, next: Scope[Key]) =>
    onChange({ ...value, [key]: next });
  const local = (iso?: string) => {
    if (!iso) return '';
    const time = new Date(iso);
    return new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const iso = (date: string) => (date ? new Date(date).toISOString() : undefined);
  return (
    <>
      <div className="two-col">
        <GenreSelect
          value={value.genre}
          onChange={(genre) => change('genre', genre as Scope['genre'])}
        />
        <Select
          label={t.workspaceUi.locationType}
          value={value.locationType}
          onChange={(location) => change('locationType', location as Scope['locationType'])}
        >
          <option value="outdoor">{t.workspaceUi.outdoor}</option>
          <option value="indoor">{t.workspaceUi.indoor}</option>
          <option value="studio">{t.workspaceUi.studioLocation}</option>
        </Select>
        <Field
          label={t.workspaceUi.location}
          value={value.location}
          onChange={(location) => change('location', location)}
        />
        <NumberField
          label={t.workspaceUi.people}
          value={value.people}
          min={1}
          onChange={(number) => change('people', number)}
        />
        <DateField
          label={t.booking.start}
          value={local(value.scheduledStart)}
          onChange={(date) => change('scheduledStart', iso(date))}
        />
        <DateField
          label={t.booking.end}
          value={local(value.scheduledEnd)}
          onChange={(date) => change('scheduledEnd', iso(date))}
        />
        <NumberField
          label={t.workspaceUi.photos}
          value={value.photoCount}
          onChange={(number) => change('photoCount', number)}
        />
        <NumberField
          label={t.workspaceUi.retouched}
          value={value.retouchedCount}
          onChange={(number) => change('retouchedCount', number)}
        />
        <NumberField
          label={t.workspaceUi.revisions}
          value={value.revisionLimit}
          onChange={(number) => change('revisionLimit', number)}
        />
        <NumberField
          label={t.workspaceUi.budget}
          value={value.budget}
          onChange={(number) => change('budget', number)}
        />
      </div>
      <Area
        label={t.workspaceUi.crew}
        value={value.crew}
        onChange={(crew) => change('crew', crew)}
      />
      <Area
        label={t.workspaceUi.notes}
        value={value.notes}
        onChange={(notes) => change('notes', notes)}
      />
    </>
  );
}
