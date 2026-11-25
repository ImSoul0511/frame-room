import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  photographerInputSchema,
  profileInputSchema,
  serviceInputSchema,
  type OwnPhotographer,
  type Profile,
  type Service,
} from '@frameroom/shared';
import { patch, post, RequestError } from '../../lib/api';
import { GenreChoices } from './GenreChoices';
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
  const [contact, setContact] = useState(initial?.contactEmail ?? '');
  const task = useTask(async () => {
    const input = photographerInputSchema.parse({
      displayName: name,
      bio,
      city,
      district,
      genres: selectedGenres,
      contactEmail: contact || null,
      styles: initial?.styles,
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
      <GenreChoices value={selectedGenres} onChange={setGenres} />
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
  const fields = useRef<HTMLFieldSetElement>(null);
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.userName);
  const [saved, setSaved] = useState({
    displayName: profile.displayName,
    userName: profile.userName,
  });
  const [attempted, setAttempted] = useState(false);
  const parsed = profileInputSchema.safeParse({ displayName: name, userName: username });
  const changed =
    name.trim() !== saved.displayName || username.trim().toLowerCase() !== saved.userName;
  const task = useMutation({
    mutationFn: (input: { displayName: string; userName: string }) =>
      patch<Profile>('/v1/me', input),
    onMutate: () => client.cancelQueries({ queryKey: ['profile', profile.id] }),
    onSuccess: (updated) => {
      client.setQueryData(['profile', profile.id], updated);
      setName(updated.displayName);
      setUsername(updated.userName);
      setSaved({ displayName: updated.displayName, userName: updated.userName });
      setAttempted(false);
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['profile', profile.id] }),
        client.invalidateQueries({ queryKey: ['api', profile.id, '/v1/me'] }),
      ]),
  });
  const usernameTaken =
    task.error instanceof RequestError && task.error.reason === 'user_name_taken';
  const invalidField = (field: 'displayName' | 'userName') =>
    attempted && !parsed.success && parsed.error.issues.some((issue) => issue.path[0] === field);
  return (
    <Form
      onSubmit={() => {
        if (!changed || task.isPending) return;
        setAttempted(true);
        if (!parsed.success) {
          const autocomplete =
            parsed.error.issues[0].path[0] === 'displayName' ? 'nickname' : 'username';
          fields.current
            ?.querySelector<HTMLInputElement>(`input[autocomplete="${autocomplete}"]`)
            ?.focus();
          return;
        }
        task.mutate(parsed.data);
      }}
    >
      <fieldset ref={fields} className="profile-edit-fields" disabled={task.isPending}>
        <Field
          label={t.displayName}
          value={name}
          onChange={(value) => {
            setName(value);
            task.reset();
          }}
          description={t.profileUi.displayNameHint}
          error={invalidField('displayName') ? t.profileUi.displayNameInvalid : undefined}
          autoComplete="nickname"
          required
          disabled={task.isPending}
        />
        <Field
          label={t.userName}
          value={username}
          onChange={(value) => {
            setUsername(value);
            task.reset();
          }}
          description={t.profileUi.usernameHint}
          error={
            usernameTaken
              ? t.errors.user_name_taken
              : invalidField('userName')
                ? t.profileUi.usernameHint
                : undefined
          }
          autoComplete="username"
          required
          disabled={task.isPending}
        />
      </fieldset>
      <Feedback
        error={usernameTaken ? null : task.error}
        success={task.isSuccess ? t.saved : null}
      />
      <div className="profile-update-action">
        <Action type="submit" pending={task.isPending} disabled={!changed}>
          {t.save}
        </Action>
        {changed ? (
          <Action
            secondary
            disabled={task.isPending}
            onClick={() => {
              setName(saved.displayName);
              setUsername(saved.userName);
              setAttempted(false);
              task.reset();
            }}
          >
            {t.cancel}
          </Action>
        ) : null}
      </div>
    </Form>
  );
}
