import { useState } from 'react';
import { briefContentSchema, type BriefContent } from '@frameroom/shared';
import { Action, Area, Feedback, Field, Form } from '../../components/ui';
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
