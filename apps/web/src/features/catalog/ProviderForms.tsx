import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Profile, Service } from '@frameroom/shared';
import { patch, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import {
  Action,
  Area,
  Feedback,
  Field,
  Form,
  GenreSelect,
  NumberField,
  Select,
} from '../../components/ui';

export function PhotographerForm() {
  const t = useStrings();
  const { profile } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [genre, setGenre] = useState('portrait');
  const [styles, setStyles] = useState('');
  const task = useTask(async () => {
    await post('/v1/photographers/me', {
      displayName: name,
      bio,
      city,
      district,
      genres: [genre],
      styles: styles
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    await client.invalidateQueries({ queryKey: ['profile'] });
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      <Field label={t.displayName} value={name} onChange={setName} />
      <Area label={t.bio} value={bio} onChange={setBio} />
      <div className="two-col">
        <Field label={t.city} value={city} onChange={setCity} />
        <Field label={t.district} value={district} onChange={setDistrict} />
      </div>
      <GenreSelect value={genre} onChange={setGenre} />
      <Field label={t.portfolio.styles} value={styles} onChange={setStyles} />
      <Feedback error={task.error} />
      <Action type="submit" pending={task.isPending}>
        {t.save}
      </Action>
    </Form>
  );
}
export function ServiceForm({
  studioId,
  initial,
  onDone,
}: {
  studioId?: string;
  initial?: Service;
  onDone?: () => void;
}) {
  const t = useStrings();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [genre, setGenre] = useState(initial?.genre ?? 'portrait');
  const [price, setPrice] = useState(initial?.price ?? 1500000);
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 120);
  const [photos, setPhotos] = useState(initial?.photoCount ?? 20);
  const [retouched, setRetouched] = useState(initial?.retouchedCount ?? 5);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const task = useTask(async () => {
    const input = {
      name,
      description,
      genre,
      price,
      durationMinutes: duration,
      photoCount: photos,
      retouchedCount: retouched,
      isActive: active,
    };
    if (initial) await patch(`/v1/services/${initial.id}`, input);
    else await post(studioId ? `/v1/studios/${studioId}/services` : '/v1/services', input);
    onDone?.();
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      <Field label={t.studio.services} value={name} onChange={setName} required />
      <Area label={t.studio.description} value={description} onChange={setDescription} />
      <GenreSelect value={genre} onChange={(value) => setGenre(value as Service['genre'])} />
      <div className="two-col">
        <NumberField label={t.studio.price} value={price} onChange={setPrice} />
        <NumberField label={t.studio.duration} value={duration} onChange={setDuration} min={15} />
        <NumberField label={t.studio.photos} value={photos} onChange={setPhotos} />
        <NumberField label={t.studio.retouched} value={retouched} onChange={setRetouched} />
      </div>
      <Select
        label={t.portfolio.status}
        value={String(active)}
        onChange={(v) => setActive(v === 'true')}
      >
        <option value="true">{t.studio.active}</option>
        <option value="false">{t.studio.inactive}</option>
      </Select>
      <Feedback error={task.error} />
      <Action type="submit" pending={task.isPending}>
        {t.save}
      </Action>
    </Form>
  );
}
export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useStrings();
  const client = useQueryClient();
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.userName);
  const task = useTask(async () => {
    await patch('/v1/me', { displayName: name, userName: username });
    await client.invalidateQueries({ queryKey: ['profile'] });
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      <Field label={t.displayName} value={name} onChange={setName} />
      <Field label={t.userName} value={username} onChange={setUsername} />
      <Feedback error={task.error} success={task.isSuccess ? t.saved : null} />
      <Action type="submit" pending={task.isPending}>
        {t.save}
      </Action>
    </Form>
  );
}
