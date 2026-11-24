import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  genres,
  photographerInputSchema,
  serviceInputSchema,
  type OwnPhotographer,
  type Profile,
  type Service,
} from '@frameroom/shared';
import { patch, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import {
  Action,
  Area,
  Feedback,
  Field,
  Form,
  GenreSelect,
  NumberField,
  QueryState,
  Select,
} from '../../components/ui';

export function PhotographerForm() {
  const own = useApi<OwnPhotographer | null>('/v1/photographers/me');
  if (own.data === undefined) return <QueryState query={own} />;
  return <PhotographerEditor initial={own.data} />;
}

function PhotographerEditor({ initial }: { initial: OwnPhotographer | null }) {
  const t = useStrings();
  const { profile, session } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState(initial?.displayName ?? profile?.displayName ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [district, setDistrict] = useState(initial?.district ?? '');
  const [selectedGenres, setGenres] = useState<OwnPhotographer['genres']>(
    initial?.genres ?? ['portrait'],
  );
  const [styles, setStyles] = useState(initial?.styles.join(', ') ?? '');
  const [contact, setContact] = useState(initial?.contactEmail ?? '');
  const [roles, setRoles] = useState(initial?.professionalRoles ?? []);
  const task = useTask(async () => {
    const input = photographerInputSchema.parse({
      displayName: name,
      bio,
      city,
      district,
      genres: selectedGenres,
      contactEmail: contact || null,
      professionalRoles: roles,
      styles: styles
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (initial) {
      const queryKey = ['api', session?.user.id ?? 'public', '/v1/photographers/me'];
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<OwnPhotographer | null>(queryKey);
      client.setQueryData<OwnPhotographer | null>(
        queryKey,
        (current) => current && { ...current, ...input },
      );
      try {
        await patch('/v1/photographers/me', input);
      } catch (error) {
        client.setQueryData<OwnPhotographer | null>(queryKey, (current) =>
          current && current.displayName === input.displayName && current.bio === input.bio
            ? previous
            : current,
        );
        await client.invalidateQueries({ queryKey });
        throw error;
      }
    } else await post('/v1/photographers/me', input);
    await client.invalidateQueries({ queryKey: ['profile'] });
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      <Field label={t.displayName} value={name} onChange={setName} required />
      <Area label={t.bio} value={bio} onChange={setBio} />
      <div className="two-col">
        <Field label={t.city} value={city} onChange={setCity} required />
        <Field label={t.district} value={district} onChange={setDistrict} />
      </div>
      <Field
        label={t.workspaceUi.contactInfo}
        type="email"
        value={contact}
        onChange={setContact}
        required
      />
      <fieldset>
        <legend>{t.portfolio.genre}</legend>
        {genres.map((genre) => (
          <label className="checkbox-row" key={genre}>
            <input
              type="checkbox"
              checked={selectedGenres.includes(genre)}
              disabled={!selectedGenres.includes(genre) && selectedGenres.length >= 5}
              onChange={(event) =>
                setGenres(
                  event.target.checked
                    ? [...selectedGenres, genre]
                    : selectedGenres.filter((item) => item !== genre),
                )
              }
            />
            {t.genreLabels[genre]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t.workspaceUi.professionalRoles}</legend>
        {(['photographer', 'retoucher', 'art_director'] as const).map((role) => (
          <label className="checkbox-row" key={role}>
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={(event) =>
                setRoles(
                  event.target.checked ? [...roles, role] : roles.filter((item) => item !== role),
                )
              }
            />
            {role === 'art_director'
              ? t.workspaceUi.artDirector
              : role === 'retoucher'
                ? t.workspaceUi.retoucher
                : t.photographer}
          </label>
        ))}
      </fieldset>
      <Field label={t.portfolio.styles} value={styles} onChange={setStyles} />
      <Feedback error={task.error} success={task.isSuccess ? t.saved : null} />
      <Action type="submit" pending={task.isPending} disabled={!selectedGenres.length}>
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
  const { session } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [genre, setGenre] = useState(initial?.genre ?? 'portrait');
  const [price, setPrice] = useState(initial?.price ?? 1500000);
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 120);
  const [photos, setPhotos] = useState(initial?.photoCount ?? 20);
  const [retouched, setRetouched] = useState(initial?.retouchedCount ?? 5);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [quota, setQuota] = useState(
    initial?.selectionQuota ?? Math.max(1, Math.min(200, initial?.retouchedCount ?? 5)),
  );
  const [revisions, setRevisions] = useState(initial?.revisionLimit ?? 2);
  const task = useTask(async () => {
    const input = serviceInputSchema.parse({
      name,
      description,
      genre,
      price,
      durationMinutes: duration,
      photoCount: photos,
      retouchedCount: retouched,
      isActive: active,
      selectionQuota: quota,
      revisionLimit: revisions,
    });
    if (initial) {
      const queryKey = ['api', session?.user.id ?? 'public', '/v1/me/services'];
      await client.cancelQueries({ queryKey });
      const previous = client
        .getQueryData<Service[]>(queryKey)
        ?.find((item) => item.id === initial.id);
      client.setQueryData<Service[]>(queryKey, (items) =>
        items?.map((item) => (item.id === initial.id ? { ...item, ...input } : item)),
      );
      try {
        await patch(`/v1/services/${initial.id}`, input);
      } catch (error) {
        client.setQueryData<Service[]>(queryKey, (items) =>
          items?.map((item) =>
            item.id === initial.id &&
            item.name === input.name &&
            item.price === input.price &&
            previous
              ? previous
              : item,
          ),
        );
        await client.invalidateQueries({ queryKey });
        throw error;
      }
    } else await post(studioId ? `/v1/studios/${studioId}/services` : '/v1/services', input);
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
        <NumberField label={t.workspaceUi.quota} value={quota} onChange={setQuota} min={1} />
        <NumberField label={t.workspaceUi.revisions} value={revisions} onChange={setRevisions} />
      </div>
      <Select
        label={t.portfolio.status}
        value={String(active)}
        onChange={(v) => setActive(v === 'true')}
      >
        <option value="true">{t.studio.active}</option>
        <option value="false">{t.studio.inactive}</option>
      </Select>
      <Feedback error={task.error} success={task.isSuccess && !onDone ? t.saved : null} />
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
  const task = useMutation({
    mutationFn: (input: { displayName: string; userName: string }) =>
      patch<Profile>('/v1/me', input),
    onMutate: async (input) => {
      const queryKey = ['profile', profile.id];
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Profile>(queryKey);
      client.setQueryData<Profile>(queryKey, (current) => current && { ...current, ...input });
      return { previous, queryKey };
    },
    onError: (_error, input, context) => {
      client.setQueryData<Profile>(context?.queryKey ?? [], (current) =>
        current && current.displayName === input.displayName && current.userName === input.userName
          ? (context?.previous ?? current)
          : current,
      );
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['profile', profile.id] }),
        client.invalidateQueries({ queryKey: ['api', profile.id, '/v1/me'] }),
      ]),
  });
  return (
    <Form onSubmit={() => task.mutate({ displayName: name, userName: username })}>
      <Field label={t.displayName} value={name} onChange={setName} />
      <Field label={t.userName} value={username} onChange={setUsername} />
      <Feedback error={task.error} success={task.isSuccess ? t.saved : null} />
      <Action type="submit" pending={task.isPending}>
        {t.save}
      </Action>
    </Form>
  );
}
