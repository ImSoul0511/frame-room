import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Area, Icon, Modal, Select, TagPicker } from './controls';
import { categoryNames, genreNames, s } from './strings';
import type { Act, Album, Dataset, Photo, Photographer, Tag } from './types';

type Shared = { act: Act; busy: boolean; onClose: () => void };
const discard = (dirty: boolean, close: () => void) => {
  if (!dirty || window.confirm(s.discard)) close();
};

export function AlbumEditor({
  album,
  profile,
  act,
  busy,
  onClose,
  onDone,
}: Shared & { album?: Album; profile: Photographer; onDone: (id: string) => void }) {
  const [title, setTitle] = useState(album?.title ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [genre, setGenre] = useState(album?.genre ?? profile.genres[0]);
  const [status, setStatus] = useState(album?.status ?? 'draft');
  const [requestId] = useState(() => crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!title.trim()) {
      setError(s.required);
      return;
    }
    const result = await act('album.save', {
      ...(album ? { id: album.id } : { photographer_id: profile.id, request_id: requestId }),
      title,
      description,
      genre,
      status,
    });
    onDone(result.id ?? album!.id);
  };
  return (
    <Modal
      title={album ? s.editAlbum : s.newAlbum}
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
            <Select
              label={s.status}
              value={status}
              onChange={(value) => setStatus(value as Album['status'])}
            >
              <option value="draft">{s.draft}</option>
              <option value="published">{s.published}</option>
              <option value="hidden">{s.hidden}</option>
            </Select>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" isDisabled={busy} onClick={onClose} />
          <Button label={s.save} variant="primary" type="submit" isLoading={busy} />
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
}: Shared & {
  image: Photo;
  data: Dataset;
  onNavigate: (id: string) => void;
  previous?: string;
  next?: string;
  readOnly: boolean;
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
              variant="secondary"
              isDisabled={!previous || busy}
              onClick={() => navigate(previous)}
            />
            <span>
              {image.width} × {image.height}
            </span>
            <Button
              label={s.next}
              icon={<Icon name="arrow" />}
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
            <Area label={s.caption} value={caption} onChange={setCaption} rows={3} />
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
              label={s.save}
              variant="primary"
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
  initialTarget,
  act,
  busy,
  onClose,
  onCreate,
  onMoved,
}: Shared & {
  data: Dataset;
  selected: string[];
  currentAlbum?: string | null;
  initialTarget?: string;
  onCreate: () => void;
  onMoved: () => void;
}) {
  const albums = data.portfolios.filter(
    (a) =>
      !a.deleted_at &&
      !data.photographers.find((p) => p.id === a.photographer_id)?.is_hidden &&
      a.id !== currentAlbum,
  );
  const [target, setTarget] = useState(initialTarget ?? albums[0]?.id ?? '');
  const submit = async () => {
    await act('images.move', { ids: selected, portfolio_id: target });
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
          <p className="field-hint">{s.destinationHint}</p>
          {albums.length ? (
            <Select label={s.destination} value={target} onChange={setTarget}>
              {data.photographers
                .filter((p) => !p.is_hidden)
                .map((p) => (
                  <optgroup key={p.id} label={p.display_name}>
                    {albums
                      .filter((a) => a.photographer_id === p.id)
                      .map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </Select>
          ) : (
            <p>{s.destinationEmpty}</p>
          )}
          <Button label={s.newAlbum} icon={<Icon name="plus" />} onClick={onCreate} />
        </fieldset>
        <footer className="modal-footer">
          <Button label={s.cancel} variant="ghost" onClick={onClose} isDisabled={busy} />
          <Button
            label={s.move}
            variant="primary"
            type="submit"
            isDisabled={!target}
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
