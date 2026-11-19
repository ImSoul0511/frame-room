import { useState } from 'react';
import { Action, Area, Field, Feedback, Form, PageHeading } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { DemoTabs, OwnerPicker } from './ui';
import { AlbumPanel, ServicePanel, SchedulePanel } from './CatalogPanels';
import type { Genre } from './types';

export function DemoProfileEditor() {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const profile = demo.state.profiles[demo.role];
  const [value, setValue] = useState({
    ...structuredClone(profile),
    name: demo.text(profile.name),
    bio: demo.text(profile.bio),
  });
  const [saved, setSaved] = useState(false);
  return (
    <section className="workspace-card workspace-profile-editor">
      <Form
        onSubmit={() => {
          setSaved(task.execute({ type: 'profile', profile: value }));
        }}
      >
        <Field
          label={t.displayName}
          value={value.name}
          onChange={(name) => {
            setValue({ ...value, name });
            setSaved(false);
          }}
          required
        />
        <Area label={t.bio} value={value.bio} onChange={(bio) => setValue({ ...value, bio })} />
        <Field
          label={t.city}
          value={value.city}
          onChange={(city) => setValue({ ...value, city })}
        />
        <fieldset>
          <legend>{t.genres}</legend>
          <div className="workspace-checkbox-grid">
            {Object.entries(t.genreLabels).map(([key, label]) => (
              <label key={key} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={value.genres.includes(key as Genre)}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      genres: event.target.checked
                        ? [...value.genres, key as Genre]
                        : value.genres.filter((genre) => genre !== key),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t.demo.professionalRoles}</legend>
          <p className="muted">{t.demo.specialtiesHint}</p>
          {(['photographer', 'retoucher', 'artDirector'] as const).map((key) => (
            <label className="checkbox-row" key={key}>
              <input
                type="checkbox"
                checked={value.specialties.includes(key)}
                onChange={(event) =>
                  setValue({
                    ...value,
                    specialties: event.target.checked
                      ? [...value.specialties, key]
                      : value.specialties.filter((specialty) => specialty !== key),
                  })
                }
              />
              {t.demo[key]}
            </label>
          ))}
        </fieldset>
        <Feedback error={task.error} success={saved ? t.demo.saved : null} />
        <Action type="submit">{t.save}</Action>
      </Form>
    </section>
  );
}
export function WorkspaceCatalogPage() {
  const demo = useDemo();
  const t = useStrings();
  const [tab, setTab] = useState('profile');
  const [owner, setOwner] = useState(demo.role);
  return (
    <>
      <PageHeading title={t.demo.portfolio} subtitle={t.demo.specialtiesHint} />
      <div className="workspace-owner-picker">
        <OwnerPicker
          value={owner}
          onChange={(value) => {
            setOwner(value as typeof owner);
            if (tab === 'profile') setTab('albums');
          }}
        />
      </div>
      <DemoTabs
        tabs={[
          ...(owner === demo.role ? [{ id: 'profile', label: t.demo.profile }] : []),
          { id: 'albums', label: t.demo.albums },
          { id: 'services', label: t.demo.services },
          { id: 'schedule', label: t.demo.schedule },
        ]}
        value={tab}
        onChange={setTab}
      >
        {tab === 'profile' && owner === demo.role ? (
          <DemoProfileEditor key={demo.role} />
        ) : tab === 'services' ? (
          <ServicePanel key={owner} owner={owner} />
        ) : tab === 'schedule' ? (
          <SchedulePanel key={owner} owner={owner} />
        ) : (
          <AlbumPanel key={owner} owner={owner} />
        )}
      </DemoTabs>
    </>
  );
}
