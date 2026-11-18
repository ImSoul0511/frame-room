import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Area, Icon, Modal, Select, TagPicker } from './controls';
import { categoryNames, genreNames, s } from './strings';
import { isInbox } from './types';
import type { Act, Album, Dataset, Photo, Photographer, Tag } from './types';

type Shared = { act: Act; busy: boolean; onClose: () => void };
const discard = (dirty: boolean, close: () => void) => {
  if (!dirty || window.confirm(s.discard)) close();
};

export function AlbumEditor({
  album,
  selectedIds,
  defaultGenre,
  act,
  busy,
  onClose,
  onDone,
}: Shared & {
  album?: Album;
  selectedIds: string[];
  defaultGenre: string;
  onDone: (id: string) => void;
}) {
  const [title, setTitle] = useState(album?.title ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [genre, setGenre] = useState(album?.genre ?? defaultGenre);
  const assigned = !!album?.photographer_id;
  const [status, setStatus] = useState(album?.status ?? 'draft');
  const [requestId] = useState(() => crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!title.trim()) {
      setError(s.required);
      return;
    }
    const result = await act(assigned ? 'album.save' : 'set.save', {
      ...(album ? { id: album.id } : { request_id: requestId }),
      ...(!album && selectedIds.length ? { ids: selectedIds } : {}),
      title,
      description,
      genre,
      ...(assigned ? { status } : {}),
    });
    const id = result.id ?? album?.id;
    if (id) onDone(id);
  };
  return (
    <Modal
      title={album ? s.editAlbum : selectedIds.length ? s.groupSelection : s.newAlbum}
      onClose={() => discard(dirty, onClose)}
      busy={busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => {});
        }}
        onChange={() => setDirty(true)}
      >
        <fieldset disabled={busy} className="form-content">
          <TextInput label={s.title} value={title} onChange={setTitle} isRequired hasAutoFocus />
          <Area label={s.description} value={description} onChange={setDescription} rows={5} />
          <div className="field-row">
            <Select label={s.genre} value={genre} onChange={setGenre}>
              {Object.entries(genreNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            {assigned && (
              <Select
                label={s.status}
                value={status}
                onChange={(value) => setStatus(value as Album['status'])}
              >
                <option value="draft">{s.draft}</option>
                <option value="published">{s.published}</option>
                <option value="hidden">{s.hidden}</option>
              </Select>
            )}
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" isDisabled={busy} onClick={onClose} />
          <Button
            label={!album && selectedIds.length ? s.groupSelection : s.save}
            variant="primary"
            type="submit"
            isLoading={busy}
          />
        </footer>
      </form>
    </Modal>
  );
}

export function SetAssignmentEditor({
  album,
  profiles,
  act,
  busy,
  onClose,
}: Shared & { album: Album; profiles: Photographer[] }) {
  const [owner, setOwner] = useState(album.photographer_id ?? '');
  const label = album.photographer_id ? s.changeSetOwner : s.assignSet;
  const canSubmit = !!owner && owner !== album.photographer_id;
  return (
    <Modal title={label} onClose={onClose} busy={busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            void act('set.assign', { id: album.id, photographer_id: owner })
              .then(onClose)
              .catch(() => {});
          }
        }}
      >
        <fieldset className="form-content" disabled={busy}>
          <strong>{album.title}</strong>
          <Select label={s.owner} value={owner} onChange={setOwner}>
            <option value="" disabled>
              {s.chooseOwner}
            </option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name}
              </option>
            ))}
          </Select>
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" isDisabled={busy} onClick={onClose} />
          <Button
            label={label}
            variant="primary"
            type="submit"
            isDisabled={!canSubmit}
            isLoading={busy}
          />
        </footer>
      </form>
    </Modal>
  );
}

export function AssignProfileAlbums({
  profile,
  albums,
  act,
  busy,
  onClose,
}: Shared & { profile: Photographer; albums: Album[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const saving = busy || submitting;
  const shown = albums.filter((album) =>
    [album.title, genreNames[album.genre]]
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const submit = async () => {
    if (!selected.length || saving) return;
    setSubmitting(true);
    try {
      for (const id of selected) {
        await act('set.assign', { id, photographer_id: profile.id });
        setSelected((remaining) => remaining.filter((value) => value !== id));
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal title={s.assignProfileAlbums} onClose={onClose} busy={saving}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => {});
        }}
      >
        <fieldset className="form-content" disabled={saving}>
          <strong>{profile.display_name}</strong>
          <TextInput
            label={s.albumSearch}
            isLabelHidden
            placeholder={s.albumSearch}
            value={query}
            onChange={setQuery}
            hasClear
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
          />
          <div className="tag-options" role="group" aria-label={s.allAlbums}>
            {shown.map((album) => (
              <label className="tag-option" key={album.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(album.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelected((ids) =>
                      checked ? [...ids, album.id] : ids.filter((id) => id !== album.id),
                    );
                  }}
                />
                <span>{album.title}</span>
                <small>{genreNames[album.genre] ?? album.genre}</small>
              </label>
            ))}
            {!shown.length && (
              <p className="field-hint">{albums.length ? s.noAlbums : s.noAssignableAlbums}</p>
            )}
          </div>
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" isDisabled={saving} onClick={onClose} />
          <Button
            label={selected.length ? s.assignCount(selected.length) : s.assignSet}
            variant="primary"
            type="submit"
            isDisabled={!selected.length}
            isLoading={saving}
          />
        </footer>
      </form>
    </Modal>
  );
}

export function ProfileEditor({ profile, act, busy, onClose }: Shared & { profile: Photographer }) {
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [city, setCity] = useState(profile.city);
  const dirty = name !== profile.display_name || bio !== profile.bio || city !== profile.city;
  const submit = async () => {
    await act('photographer.save', { id: profile.id, display_name: name, bio, city });
    onClose();
  };
  return (
    <Modal title={s.editProfile} onClose={() => discard(dirty, onClose)} busy={busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void submit().catch(() => {});
        }}
      >
        <fieldset disabled={busy} className="form-content">
          <p className="field-hint">{s.profileHelp}</p>
          <TextInput label={s.name} value={name} onChange={setName} isRequired />
          <TextInput label={s.city} value={city} onChange={setCity} />
          <Area label={s.bio} value={bio} onChange={setBio} rows={5} />
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" isDisabled={busy} onClick={onClose} />
          <Button label={s.save} variant="primary" type="submit" isLoading={busy} />
        </footer>
      </form>
    </Modal>
  );
}

export function ImageEditor({
  image,
  data,
  act,
  busy,
  onClose,
  onNavigate,
  previous,
  next,
  readOnly,
  onDelete,
}: Shared & {
  image: Photo;
  data: Dataset;
  onNavigate: (id: string) => void;
  previous?: string;
  next?: string;
  readOnly: boolean;
  onDelete: () => void;
}) {
  const originalTags = data.assignments
    .filter((a) => a.portfolio_image_id === image.id)
    .map((a) => a.tag_id);
  const [caption, setCaption] = useState(image.caption);
  const [state, setState] = useState(image.label_status);
  const [tags, setTags] = useState(originalTags);
  const dirty =
    caption !== image.caption ||
    state !== image.label_status ||
    [...tags].sort().join() !== [...originalTags].sort().join();
  const submit = async () => {
    await act('image.save', { id: image.id, caption, label_status: state, tag_ids: tags });
    onClose();
  };
  const navigate = (id?: string) => {
    if (id) discard(dirty, () => onNavigate(id));
  };
  return (
    <Modal title={s.openImage} wide onClose={() => discard(dirty, onClose)} busy={busy}>
      <div className="image-editor">
        <div className="image-preview">
          <img src={image.url} alt={image.caption || s.photoDescriptionEmpty} />
          <div className="preview-controls">
            <Button
              label={s.previous}
              icon={<Icon name="back" />}
              variant="ghost"
              isDisabled={!previous || busy}
              onClick={() => navigate(previous)}
            />
            <span>
              {image.width} × {image.height}
            </span>
            <Button
              label={s.next}
              icon={<Icon name="arrow" />}
              variant="ghost"
              isDisabled={!next || busy}
              onClick={() => navigate(next)}
            />
          </div>
        </div>
        <form
          className="image-fields"
          onSubmit={(event) => {
            event.preventDefault();
            void submit().catch(() => {});
          }}
        >
          <fieldset disabled={busy || readOnly}>
            <Area label={s.caption} value={caption} onChange={setCaption} rows={2} />
            <Select
              label={s.annotationState}
              value={state}
              onChange={(value) => setState(value as Photo['label_status'])}
            >
              <option value="unlabeled">{s.unlabeled}</option>
              <option value="suggested">{s.suggested}</option>
              <option value="reviewed">{s.reviewed}</option>
            </Select>
            <TagPicker tags={data.tags} selected={tags} onChange={setTags} />
          </fieldset>
          <footer className="image-editor-footer">
            <Button
              label={s.deletePhoto}
              variant="destructive"
              size="sm"
              isDisabled={busy || readOnly || !data.delete_ready}
              onClick={onDelete}
            />
            <Button
              label={s.save}
              variant="primary"
              size="sm"
              type="submit"
              isLoading={busy}
              isDisabled={readOnly}
            />
          </footer>
        </form>
      </div>
    </Modal>
  );
}

export function MoveEditor({
  data,
  selected,
  currentAlbum,
  act,
  busy,
  onClose,
  onCreate,
  onMoved,
}: Shared & {
  data: Dataset;
  selected: string[];
  currentAlbum?: string | null;
  onCreate?: () => void;
  onMoved: () => void;
}) {
  const albums = data.portfolios.filter(
    (a) =>
      !a.deleted_at &&
      !data.photographers.find((p) => p.id === a.photographer_id)?.is_hidden &&
      a.id !== currentAlbum,
  );
  const owners = new Map(data.photographers.map((profile) => [profile.id, profile.display_name]));
  const groups = [
    ...Object.entries(genreNames).map(([genre, label]) => ({
      label,
      albums: albums.filter((album) => album.genre === genre && !isInbox(album)),
    })),
    { label: s.inbox, albums: albums.filter(isInbox) },
  ].filter((group) => group.albums.length);
  const [target, setTarget] = useState(groups[0]?.albums[0].id ?? '');
  const selectedIds = new Set(selected);
  const movableIds = data.images
    .filter((image) => selectedIds.has(image.id) && image.portfolio_id !== target)
    .map((image) => image.id);
  const submit = async () => {
    if (!target || !movableIds.length) return;
    await act('images.move', { ids: movableIds, portfolio_id: target });
    onMoved();
  };
  return (
    <Modal title={`${s.movePhotos} · ${selected.length} ${s.photos}`} onClose={onClose} busy={busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => {});
        }}
      >
        <fieldset disabled={busy} className="form-content">
          {albums.length ? (
            <Select label={s.destination} value={target} onChange={setTarget}>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.albums.map((album) => (
                    <option value={album.id} key={album.id}>
                      {album.title} ·{' '}
                      {album.photographer_id ? owners.get(album.photographer_id) : s.unassignedSet}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          ) : (
            <p>{s.destinationEmpty}</p>
          )}
          {onCreate && (
            <Button label={s.groupSelection} icon={<Icon name="plus" />} onClick={onCreate} />
          )}
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" onClick={onClose} isDisabled={busy} />
          <Button
            label={s.move}
            variant="primary"
            type="submit"
            isDisabled={!target || !movableIds.length}
            isLoading={busy}
          />
        </footer>
      </form>
    </Modal>
  );
}

export function BulkTagEditor({
  tags,
  selected,
  mode,
  act,
  busy,
  onClose,
}: Shared & { tags: Tag[]; selected: string[]; mode: 'add' | 'remove' }) {
  const [tagIds, setTagIds] = useState<string[]>([]);
  const submit = async () => {
    await act('images.tags', { ids: selected, tag_ids: tagIds, mode });
    onClose();
  };
  return (
    <Modal
      title={`${mode === 'add' ? s.addTags : s.removeTags} · ${selected.length} ${s.photos}`}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => {});
        }}
      >
        <fieldset className="form-content" disabled={busy}>
          <TagPicker
            tags={tags}
            selected={tagIds}
            onChange={setTagIds}
            includeInactive={mode === 'remove'}
          />
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" onClick={onClose} isDisabled={busy} />
          <Button
            label={mode === 'add' ? s.addTags : s.removeTags}
            type="submit"
            variant="primary"
            isDisabled={!tagIds.length}
            isLoading={busy}
          />
        </footer>
      </form>
    </Modal>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
export function TagEditor({ tag, act, busy, onClose }: Shared & { tag?: Tag }) {
  const [vi, setVi] = useState(tag?.name_vi ?? '');
  const [en, setEn] = useState(tag?.name ?? '');
  const [slug, setSlug] = useState(tag?.slug ?? '');
  const [category, setCategory] = useState(tag?.category ?? 'mood');
  const [definitionVi, setDefinitionVi] = useState(tag?.definition_vi ?? '');
  const [definitionEn, setDefinitionEn] = useState(tag?.definition_en ?? '');
  const [aliases, setAliases] = useState(tag?.aliases.join(', ') ?? '');
  const [dirty, setDirty] = useState(false);
  const submit = async () => {
    await act('tag.save', {
      ...(tag ? { id: tag.id } : {}),
      slug,
      name: en.trim() || vi.trim(),
      name_vi: vi.trim(),
      category,
      definition_vi: definitionVi,
      definition_en: definitionEn,
      aliases: [
        ...new Set(
          aliases
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ],
    });
    onClose();
  };
  return (
    <Modal title={tag ? s.editTag : s.newTag} onClose={() => discard(dirty, onClose)} busy={busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (vi.trim() && slug.trim()) void submit().catch(() => {});
        }}
        onChange={() => setDirty(true)}
      >
        <fieldset className="form-content" disabled={busy}>
          <div className="field-row">
            <TextInput
              label={s.tagNameVi}
              value={vi}
              onChange={(value) => {
                setVi(value);
                if (!tag) setSlug(slugify(value));
              }}
              isRequired
            />
            <TextInput label={s.tagNameEn} value={en} onChange={setEn} />
          </div>
          <TextInput label={s.slug} value={slug} onChange={setSlug} isRequired />
          <Select label={s.category} value={category} onChange={setCategory}>
            {Object.entries(categoryNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Area label={s.definitionVi} value={definitionVi} onChange={setDefinitionVi} rows={3} />
          <Area label={s.definitionEn} value={definitionEn} onChange={setDefinitionEn} rows={2} />
          <TextInput label={s.aliases} value={aliases} onChange={setAliases} />
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" onClick={onClose} isDisabled={busy} />
          <Button label={s.save} type="submit" variant="primary" isLoading={busy} />
        </footer>
      </form>
    </Modal>
  );
}
