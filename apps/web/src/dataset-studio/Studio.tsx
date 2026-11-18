import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyAction, fetchDataset } from './api';
import { confirmedUpdate } from './confirmedUpdates';
import { DialogFeedback, Empty, Icon, Select } from './controls';
import {
  AlbumEditor,
  AssignProfileAlbums,
  BulkTagEditor,
  ImageEditor,
  MoveEditor,
  ProfileEditor,
  SetAssignmentEditor,
  TagEditor,
} from './editors';
import { AlbumGrid, PhotoGrid, TagLibrary } from './library';
import { categoryNames, genreNames, s } from './strings';
import {
  isInbox,
  moveId,
  ordered,
  type Act,
  type Album,
  type Dataset,
  type Photographer,
  type Tag,
} from './types';

const views = [
  ['albums', s.allAlbums],
  ['inbox', s.inbox],
  ['photos', s.allPhotos],
  ['tags', s.tags],
  ['trash', s.trash],
  ['profiles', s.profiles],
] as const;
type View = (typeof views)[number][0];
type Editor =
  | { kind: 'album'; album?: Album; withSelection?: boolean }
  | { kind: 'assign'; album: Album }
  | { kind: 'assignProfile'; profile: Photographer }
  | { kind: 'profile'; profile: Photographer }
  | { kind: 'image'; id: string }
  | { kind: 'move' }
  | { kind: 'bulkTags'; mode: 'add' | 'remove' }
  | { kind: 'tag'; tag?: Tag }
  | null;

export function Studio() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['dataset-studio'],
    queryFn: ({ signal }) => fetchDataset(signal),
    staleTime: 30000,
  });
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [albumBack, setAlbumBack] = useState<'albums' | 'profiles'>('albums');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [view, setView] = useState<View>('albums');
  const [editor, setEditorState] = useState<Editor>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [albumQuery, setAlbumQuery] = useState('');
  const [albumGenre, setAlbumGenre] = useState('');
  const [albumOwner, setAlbumOwner] = useState('');
  const [photoQuery, setPhotoQuery] = useState('');
  const [photoGenre, setPhotoGenre] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [tagCategory, setTagCategory] = useState('');
  const [showInactiveTags, setShowInactiveTags] = useState(false);
  const [profileQuery, setProfileQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const setEditor = (value: Editor) => {
    if (value) setNotice(null);
    setEditorState(value);
  };
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload: Record<string, unknown> }) =>
      applyAction(action, payload),
    onMutate: () => client.cancelQueries({ queryKey: ['dataset-studio'] }),
    onSuccess: async (_, { action, payload }) => {
      const current = client.getQueryData<Dataset>(['dataset-studio']);
      const update = current && confirmedUpdate(current, action, payload);
      if (update) client.setQueryData(['dataset-studio'], update);
      else await client.invalidateQueries({ queryKey: ['dataset-studio'] });
      setNotice({ text: action === 'images.delete' ? s.photosDeleted : s.saved, error: false });
    },
    onError: (error) => setNotice({ text: error.message, error: true }),
  });
  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const act: Act = (action, payload) => mutation.mutateAsync({ action, payload });
  const perform = (action: string, payload: Record<string, unknown>, after?: () => void) => {
    void act(action, payload)
      .then(() => after?.())
      .catch(() => {});
  };

  if (!query.data) {
    return (
      <div className="studio-loading">
        <h1>{s.studio}</h1>
        {query.isError ? (
          <>
            <p role="alert">{s.loadError}</p>
            <Button label={s.retry} onClick={() => void query.refetch()} />
          </>
        ) : (
          <p role="status">{s.loading}</p>
        )}
      </div>
    );
  }

  const data = query.data;
  const busy = mutation.isPending;
  const disabled = busy || !data.ready || data.read_only;
  const canDelete = !disabled && data.delete_ready;
  const canGroup = !disabled && data.sets_ready;
  const photoView = view === 'photos' || view === 'inbox';
  const profiles = [...data.photographers].sort(
    (a, b) =>
      (a.dataset_sort_order ?? 0) - (b.dataset_sort_order ?? 0) ||
      a.display_name.localeCompare(b.display_name, 'vi'),
  );
  const activeProfiles = profiles.filter((profile) => !profile.is_hidden);
  const profile = profiles.find((item) => item.id === profileId);
  const profileAlbums = profile
    ? ordered(
        data.portfolios.filter(
          (album) => album.photographer_id === profile.id && !album.deleted_at && !isInbox(album),
        ),
      )
    : [];
  const assignedCounts = new Map<string, number>();
  for (const album of data.portfolios) {
    if (album.photographer_id && !album.deleted_at && !isInbox(album)) {
      assignedCounts.set(
        album.photographer_id,
        (assignedCounts.get(album.photographer_id) ?? 0) + 1,
      );
    }
  }
  const albumsWithPhotos = new Set(
    data.images.filter((photo) => !photo.is_hidden).map((photo) => photo.portfolio_id),
  );
  const unassignedAlbums = data.portfolios
    .filter(
      (album) => !album.photographer_id && !album.deleted_at && albumsWithPhotos.has(album.id),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  const activeOwners = new Set(activeProfiles.map((profile) => profile.id));
  const ownerNames = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const visibleProfiles = profiles.filter(
    (profile) =>
      (showHidden || !profile.is_hidden) &&
      profile.display_name.toLowerCase().includes(profileQuery.toLowerCase()),
  );
  const activeAlbums = ordered(
    data.portfolios.filter(
      (album) =>
        !album.deleted_at &&
        (!album.photographer_id ||
          activeOwners.has(album.photographer_id) ||
          (albumBack === 'profiles' && album.id === albumId)),
    ),
  );
  const byAlbum = new Map(activeAlbums.map((album) => [album.id, album]));
  const activeAlbum = albumId ? byAlbum.get(albumId) : undefined;
  const albums = activeAlbums.filter(
    (album) =>
      !isInbox(album) &&
      (!albumGenre || album.genre === albumGenre) &&
      (!albumOwner ||
        album.photographer_id === (albumOwner === 'unassigned' ? null : albumOwner)) &&
      [album.title, album.description]
        .join(' ')
        .toLowerCase()
        .includes(albumQuery.trim().toLowerCase()),
  );
  const archivedAlbums = ordered(data.portfolios.filter((album) => !!album.deleted_at));
  const archivedImages = ordered(data.images.filter((photo) => photo.is_hidden));
  const tagsById = new Map(data.tags.map((tag) => [tag.id, tag]));
  const photoTags = new Map<string, Tag[]>();
  for (const assignment of data.assignments) {
    const tag = tagsById.get(assignment.tag_id);
    if (tag) {
      const tags = photoTags.get(assignment.portfolio_image_id) ?? [];
      tags.push(tag);
      photoTags.set(assignment.portfolio_image_id, tags);
    }
  }
  const photos = photoView
    ? ordered(
        data.images.filter((photo) => {
          const album = byAlbum.get(photo.portfolio_id);
          if (
            photo.is_hidden ||
            !album ||
            (activeAlbum && album.id !== activeAlbum.id) ||
            (view === 'inbox' && !isInbox(album)) ||
            (stateFilter && photo.label_status !== stateFilter)
          )
            return false;
          const tags = photoTags.get(photo.id) ?? [];
          if (tagFilter && !tags.some((tag) => tag.id === tagFilter)) return false;
          const genreTags = tags.filter(
            (tag) => tag.category === 'genre' && Object.hasOwn(genreNames, tag.slug),
          );
          const fallbackGenre = isInbox(album)
            ? (photo.suggested_genre ?? album.genre)
            : album.genre;
          if (
            photoGenre &&
            !(genreTags.length
              ? genreTags.some((tag) => tag.slug === photoGenre)
              : fallbackGenre === photoGenre)
          )
            return false;
          return [
            photo.caption,
            genreNames[fallbackGenre],
            ...tags.flatMap((tag) => [tag.name, tag.name_vi, ...tag.aliases]),
          ]
            .join(' ')
            .toLowerCase()
            .includes(photoQuery.trim().toLowerCase());
        }),
      )
    : [];
  const canOrderPhotos = !!activeAlbum && !stateFilter && !tagFilter && !photoGenre && !photoQuery;
  const activeAlbumHasPhotos = !!activeAlbum && albumsWithPhotos.has(activeAlbum.id);
  const selectedIds = new Set(selected);
  const everyPhotoSelected = !!photos.length && photos.every((photo) => selectedIds.has(photo.id));
  const imageInEditor =
    editor?.kind === 'image' ? data.images.find((image) => image.id === editor.id) : undefined;
  const editorImages = view === 'trash' ? archivedImages : photos;
  const editorIndex = imageInEditor
    ? editorImages.findIndex((image) => image.id === imageInEditor.id)
    : -1;
  const nextImage = editorImages[editorIndex + 1]?.id;
  const previousImage = editorImages[editorIndex - 1]?.id;
  const firstSelectedImage = selected.length
    ? data.images.find((image) => image.id === selected[0])
    : undefined;
  const selectedAlbum = firstSelectedImage
    ? byAlbum.get(firstSelectedImage.portfolio_id)
    : undefined;
  const selectedGenre =
    selectedAlbum && !isInbox(selectedAlbum)
      ? selectedAlbum.genre
      : (firstSelectedImage?.suggested_genre ?? selectedAlbum?.genre);

  const navigate = (
    next: View,
    id: string | null = null,
    back: 'albums' | 'profiles' = 'albums',
  ) => {
    setView(next);
    setAlbumId(id);
    setAlbumBack(back);
    setSelected([]);
    setPhotoQuery('');
    setPhotoGenre('');
    setStateFilter('');
    setTagFilter('');
  };
  const selectPhoto = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const openImage = (id: string) => setEditor({ kind: 'image', id });
  const archiveAlbum = (album: Album) => {
    if (album.deleted_at || window.confirm(s.confirmArchive))
      perform('album.archive', { id: album.id, archived: !album.deleted_at });
  };
  const deleteImages = (ids: string[], after?: () => void) => {
    if (!canDelete || !window.confirm(s.confirmDelete(ids.length))) return;
    perform('images.delete', { ids }, () => {
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      after?.();
    });
  };
  const orderAlbums = (ids: string[]) => {
    if (!albumOwner) return;
    // Keep inboxes in their existing slots when reordering curated albums.
    const remaining = [...ids];
    const reordered = activeAlbums
      .filter((album) => album.photographer_id === albumOwner)
      .map((album) => (isInbox(album) ? album.id : (remaining.shift() ?? album.id)));
    perform('album.order', { ids: reordered, photographer_id: albumOwner });
  };

  return (
    <DialogFeedback.Provider value={notice?.error ? notice.text : null}>
      <main className="studio-main">
        <header className="studio-topbar">
          <div className="studio-title">
            <strong>{s.brand}</strong>
            <span>{s.studio}</span>
          </div>
          <div className="top-actions">
            <Button
              label={query.isFetching ? s.refreshing : s.refresh}
              variant="ghost"
              size="sm"
              icon={<Icon name="refresh" size={16} />}
              isDisabled={busy || query.isFetching}
              onClick={() => void query.refetch()}
            />
          </div>
        </header>
        <div className="studio-content">
          <div className="view-nav">
            <nav aria-label={s.studio}>
              {views.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={view === key ? 'active' : ''}
                  aria-current={view === key ? 'page' : undefined}
                  onClick={() => {
                    if (key === 'profiles') setProfileId(null);
                    navigate(key);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            {view !== 'profiles' && view !== 'trash' && !(photoView && selected.length) && (
              <Button
                label={view === 'tags' ? s.newTag : s.newAlbum}
                variant="primary"
                icon={<Icon name="plus" />}
                isDisabled={view === 'tags' ? disabled : !canGroup}
                onClick={() => setEditor(view === 'tags' ? { kind: 'tag' } : { kind: 'album' })}
              />
            )}
          </div>
          {(data.read_only || !data.ready || !data.delete_ready) && (
            <div className="setup-banner" role="status">
              <div>
                <strong>
                  {data.read_only
                    ? s.readOnly
                    : data.ready
                      ? s.deleteMigrationNeeded
                      : s.migrationNeeded}
                </strong>
                {!data.read_only && (
                  <code>{data.ready ? data.delete_migration : data.migration}</code>
                )}
              </div>
            </div>
          )}
          {!data.read_only && data.ready && !data.sets_ready && (
            <div className="setup-banner" role="status">
              <div>
                <strong>{s.setsMigrationNeeded}</strong>
                <code>{data.sets_migration}</code>
              </div>
            </div>
          )}
          {notice && (
            <div
              role={notice.error ? 'alert' : 'status'}
              className={notice.error ? 'notice error' : 'notice'}
            >
              <span>{notice.text}</span>
              <button type="button" aria-label={s.close} onClick={() => setNotice(null)}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          {view === 'albums' && (
            <>
              <div className="section-title">
                <h1>
                  {s.allAlbums} <span>{albums.length}</span>
                </h1>
              </div>
              <div className="photo-filters">
                <Search label={s.albumSearch} value={albumQuery} onChange={setAlbumQuery} />
                <GenreFilter value={albumGenre} onChange={setAlbumGenre} />
                <Select label={s.allocation} value={albumOwner} onChange={setAlbumOwner}>
                  <option value="">{s.allOwners}</option>
                  <option value="unassigned">{s.unassignedSet}</option>
                  {activeProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.display_name}
                    </option>
                  ))}
                </Select>
              </div>
              <AlbumGrid
                albums={albums}
                images={data.images}
                ownerNames={ownerNames}
                disabled={disabled}
                onOpen={(id) => navigate('photos', id)}
                onEdit={(album) => setEditor({ kind: 'album', album })}
                onAssign={
                  canGroup && activeProfiles.length
                    ? (album) => setEditor({ kind: 'assign', album })
                    : undefined
                }
                onArchive={archiveAlbum}
                onOrder={
                  activeOwners.has(albumOwner) && !albumGenre && !albumQuery
                    ? orderAlbums
                    : undefined
                }
                emptyAction={<Button label={s.openInbox} onClick={() => navigate('inbox')} />}
              />
            </>
          )}

          {photoView && (
            <>
              <div className="section-title">
                <div>
                  {activeAlbum && (
                    <button type="button" className="back-link" onClick={() => navigate(albumBack)}>
                      <Icon name="back" size={14} />
                      {albumBack === 'profiles' ? profile?.display_name : s.allAlbums}
                    </button>
                  )}
                  <h1>
                    {activeAlbum?.title ?? (view === 'inbox' ? s.inbox : s.allPhotos)}{' '}
                    <span>{photos.length}</span>
                  </h1>
                  {activeAlbum && (
                    <p>
                      {activeAlbum.photographer_id
                        ? ownerNames.get(activeAlbum.photographer_id)
                        : s.unassignedSet}
                    </p>
                  )}
                  {activeAlbum?.description && <p>{activeAlbum.description}</p>}
                </div>
                {activeAlbum && (
                  <div className="top-actions">
                    <Button
                      label={s.editAlbum}
                      variant="secondary"
                      size="sm"
                      isDisabled={disabled}
                      onClick={() => setEditor({ kind: 'album', album: activeAlbum })}
                    />
                    <Button
                      label={activeAlbum.photographer_id ? s.changeSetOwner : s.assignSet}
                      variant="primary"
                      size="sm"
                      isDisabled={
                        !canGroup ||
                        !activeProfiles.length ||
                        (!activeAlbum.photographer_id && !activeAlbumHasPhotos)
                      }
                      onClick={() => setEditor({ kind: 'assign', album: activeAlbum })}
                    />
                  </div>
                )}
              </div>
              <div className="photo-filters">
                <Search label={s.searchPhotos} value={photoQuery} onChange={setPhotoQuery} />
                <GenreFilter value={photoGenre} onChange={setPhotoGenre} />
                <Select label={s.tags} value={tagFilter} onChange={setTagFilter}>
                  <option value="">{s.noTagFilter}</option>
                  {Object.entries(categoryNames).map(([category, label]) => (
                    <optgroup key={category} label={label}>
                      {data.tags
                        .filter((tag) => tag.is_active && tag.category === category)
                        .map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name_vi || tag.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
                <Select label={s.annotationState} value={stateFilter} onChange={setStateFilter}>
                  <option value="">{s.allStates}</option>
                  <option value="unlabeled">{s.unlabeled}</option>
                  <option value="reviewed">{s.reviewed}</option>
                  <option value="suggested">{s.suggested}</option>
                </Select>
              </div>
              <div className="selection-line">
                <label>
                  <input
                    type="checkbox"
                    checked={everyPhotoSelected}
                    disabled={disabled || !photos.length}
                    onChange={() =>
                      setSelected(
                        everyPhotoSelected
                          ? selected.filter((id) => !photos.some((photo) => photo.id === id))
                          : [...new Set([...selected, ...photos.map((photo) => photo.id)])],
                      )
                    }
                  />
                  {s.selectAll}
                </label>
                {canOrderPhotos && <p>{s.orderHint}</p>}
              </div>
              <PhotoGrid
                photos={photos}
                data={data}
                selected={selected}
                disabled={disabled}
                onSelect={selectPhoto}
                onOpen={openImage}
                showAlbum={view === 'photos' && !activeAlbum}
                onOrder={
                  activeAlbum && canOrderPhotos
                    ? (ids) => perform('images.order', { ids, portfolio_id: activeAlbum.id })
                    : undefined
                }
              />
            </>
          )}

          {view === 'tags' && (
            <>
              <div className="section-title">
                <h1>{s.tags}</h1>
              </div>
              <div className="photo-filters">
                <Search label={s.searchTags} value={tagQuery} onChange={setTagQuery} />
                <Select label={s.category} value={tagCategory} onChange={setTagCategory}>
                  <option value="">{s.allCategories}</option>
                  {Object.entries(categoryNames).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={showInactiveTags}
                    onChange={(event) => setShowInactiveTags(event.target.checked)}
                  />
                  {s.includeArchivedTags}
                </label>
              </div>
              <TagLibrary
                data={data}
                query={tagQuery}
                category={tagCategory}
                disabled={disabled}
                includeArchived={showInactiveTags}
                onEdit={(tag) => setEditor({ kind: 'tag', tag })}
                onArchive={(tag) => {
                  if (!tag.is_active || window.confirm(s.confirmArchive))
                    perform('tag.archive', { id: tag.id, archived: tag.is_active });
                }}
              />
            </>
          )}

          {view === 'trash' && (
            <>
              <div className="section-title">
                <h1>{s.trash}</h1>
              </div>
              {!archivedAlbums.length && !archivedImages.length && <Empty title={s.noTrash} />}
              {archivedImages.length > 0 && (
                <>
                  <div className="section-title">
                    <h2>
                      {s.deletedPhotos} <span>{archivedImages.length}</span>
                    </h2>
                  </div>
                  <PhotoGrid
                    photos={archivedImages}
                    data={data}
                    selected={[]}
                    disabled={disabled}
                    onSelect={() => {}}
                    onOpen={openImage}
                    onDelete={canDelete ? (id) => deleteImages([id]) : undefined}
                    onRestore={(id) => perform('images.archive', { ids: [id], archived: false })}
                  />
                </>
              )}
              {archivedAlbums.length > 0 && (
                <>
                  <div className="section-title trash-images-title">
                    <h2>
                      {s.deletedAlbums} <span>{archivedAlbums.length}</span>
                    </h2>
                  </div>
                  <AlbumGrid
                    albums={archivedAlbums}
                    images={data.images}
                    ownerNames={ownerNames}
                    disabled={disabled}
                    onOpen={() => {}}
                    onEdit={() => {}}
                    onArchive={archiveAlbum}
                  />
                </>
              )}
            </>
          )}

          {view === 'profiles' && profile && (
            <>
              <div className="section-title">
                <div>
                  <button type="button" className="back-link" onClick={() => setProfileId(null)}>
                    <Icon name="back" size={14} />
                    {s.profiles}
                  </button>
                  <h1>{profile.display_name}</h1>
                  {profile.city && <p>{profile.city}</p>}
                  {profile.bio && <p>{profile.bio}</p>}
                </div>
                <div className="top-actions">
                  <Button
                    label={s.editProfile}
                    variant="secondary"
                    size="sm"
                    isDisabled={disabled}
                    onClick={() => setEditor({ kind: 'profile', profile })}
                  />
                  <Button
                    label={s.assignProfileAlbums}
                    variant="primary"
                    size="sm"
                    isDisabled={!canGroup || profile.is_hidden}
                    onClick={() => setEditor({ kind: 'assignProfile', profile })}
                  />
                </div>
              </div>
              <div className="section-title">
                <h2>
                  {s.profileAlbums} <span>{profileAlbums.length}</span>
                </h2>
              </div>
              {profileAlbums.length ? (
                <AlbumGrid
                  albums={profileAlbums}
                  images={data.images}
                  ownerNames={ownerNames}
                  disabled={disabled}
                  onOpen={(id) => navigate('photos', id, 'profiles')}
                  onEdit={(album) => setEditor({ kind: 'album', album })}
                  onArchive={archiveAlbum}
                />
              ) : (
                <Empty title={s.noProfileAlbums} />
              )}
            </>
          )}

          {view === 'profiles' && !profile && (
            <>
              <div className="section-title">
                <h1>{s.manageProfiles}</h1>
              </div>
              <div className="photo-filters">
                <Search label={s.searchProfiles} value={profileQuery} onChange={setProfileQuery} />
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={showHidden}
                    onChange={(event) => setShowHidden(event.target.checked)}
                  />
                  {s.showHiddenProfiles}
                </label>
              </div>
              {!profiles.length && <Empty title={s.noProfiles} hint={s.noProfilesHint} />}
              <ul className="profile-management">
                {visibleProfiles.map((profile, index) => (
                  <li key={profile.id}>
                    <button
                      type="button"
                      className="profile-open"
                      onClick={() => setProfileId(profile.id)}
                    >
                      <strong>{profile.display_name}</strong>
                      <span>
                        {assignedCounts.get(profile.id) ?? 0} {s.allAlbums.toLowerCase()}
                      </span>
                    </button>
                    <div className="order-buttons">
                      {([-1, 1] as const).map((offset) => {
                        const neighbor = visibleProfiles[index + offset];
                        return (
                          <Button
                            key={offset}
                            label={offset < 0 ? s.previous : s.next}
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            icon={<Icon name={offset < 0 ? 'up' : 'down'} />}
                            isDisabled={disabled || !neighbor}
                            onClick={() =>
                              perform('photographer.order', {
                                ids: moveId(
                                  visibleProfiles.map((item) => item.id),
                                  profile.id,
                                  neighbor.id,
                                ),
                              })
                            }
                          />
                        );
                      })}
                    </div>
                    <Button
                      label={s.editProfile}
                      variant="ghost"
                      size="sm"
                      isDisabled={disabled}
                      onClick={() => setEditor({ kind: 'profile', profile })}
                    />
                    <Button
                      label={profile.is_hidden ? s.restoreProfile : s.archiveProfile}
                      variant="ghost"
                      size="sm"
                      isDisabled={disabled}
                      onClick={() => {
                        if (profile.is_hidden || window.confirm(s.confirmArchive))
                          perform('photographer.archive', {
                            id: profile.id,
                            archived: !profile.is_hidden,
                          });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {photoView && selected.length > 0 && (
          <div className="selection-toolbar">
            <strong>
              {selected.length} <span>{s.selected}</span>
            </strong>
            <div className="selection-toolbar-buttons">
              <Button
                label={s.groupSelection}
                variant="primary"
                size="sm"
                isDisabled={!canGroup}
                onClick={() => setEditor({ kind: 'album', withSelection: true })}
              />
              <Button
                label={s.movePhotos}
                size="sm"
                isDisabled={disabled}
                onClick={() => setEditor({ kind: 'move' })}
              />
              <Button
                label={s.addTags}
                size="sm"
                isDisabled={disabled}
                onClick={() => setEditor({ kind: 'bulkTags', mode: 'add' })}
              />
              <Button
                label={s.removeTags}
                size="sm"
                isDisabled={disabled}
                onClick={() => setEditor({ kind: 'bulkTags', mode: 'remove' })}
              />
              <Button
                label={s.markReviewed}
                size="sm"
                isDisabled={disabled}
                onClick={() =>
                  perform('images.review', { ids: selected, label_status: 'reviewed' }, () =>
                    setSelected([]),
                  )
                }
              />
              <Button
                label={s.remove}
                size="sm"
                variant="ghost"
                isIconOnly
                icon={<Icon name="trash" size={16} />}
                isDisabled={disabled}
                onClick={() => {
                  if (window.confirm(s.confirmPhotosArchive))
                    perform('images.archive', { ids: selected, archived: true }, () =>
                      setSelected([]),
                    );
                }}
              />
              <Button
                label={s.deletePhotos}
                size="sm"
                variant="destructive"
                isDisabled={!canDelete}
                onClick={() => deleteImages(selected)}
              />
              <Button
                label={s.clearSelection}
                size="sm"
                variant="ghost"
                isIconOnly
                icon={<Icon name="close" />}
                isDisabled={busy}
                onClick={() => setSelected([])}
              />
            </div>
          </div>
        )}
      </main>

      {editor?.kind === 'album' && (
        <AlbumEditor
          key={editor.album?.id ?? 'new'}
          album={editor.album}
          selectedIds={editor.withSelection ? selected : []}
          defaultGenre={
            (editor.withSelection ? photoGenre || selectedGenre : albumGenre) ||
            Object.keys(genreNames)[0]
          }
          act={act}
          busy={busy}
          onClose={() => setEditor(null)}
          onDone={(id) => {
            setEditor(null);
            navigate('photos', id, view === 'profiles' ? 'profiles' : albumBack);
          }}
        />
      )}
      {editor?.kind === 'assign' && (
        <SetAssignmentEditor
          album={editor.album}
          profiles={activeProfiles}
          act={act}
          busy={busy}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === 'profile' && (
        <ProfileEditor
          profile={editor.profile}
          act={act}
          busy={busy}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === 'assignProfile' && (
        <AssignProfileAlbums
          profile={editor.profile}
          albums={unassignedAlbums}
          act={act}
          busy={busy}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === 'image' && imageInEditor && (
        <ImageEditor
          key={imageInEditor.id}
          image={imageInEditor}
          data={data}
          act={act}
          busy={busy}
          readOnly={!data.ready || data.read_only}
          onClose={() => setEditor(null)}
          onNavigate={openImage}
          previous={previousImage}
          next={editorIndex >= 0 ? nextImage : undefined}
          onDelete={() =>
            deleteImages([imageInEditor.id], () => {
              const next = editorIndex >= 0 ? (nextImage ?? previousImage) : undefined;
              setEditorState(next ? { kind: 'image', id: next } : null);
            })
          }
        />
      )}
      {editor?.kind === 'move' && (
        <MoveEditor
          data={data}
          selected={selected}
          currentAlbum={activeAlbum?.id}
          act={act}
          busy={busy}
          onClose={() => setEditor(null)}
          onCreate={canGroup ? () => setEditor({ kind: 'album', withSelection: true }) : undefined}
          onMoved={() => {
            setEditor(null);
            setSelected([]);
          }}
        />
      )}
      {editor?.kind === 'bulkTags' && (
        <BulkTagEditor
          tags={data.tags}
          selected={selected}
          mode={editor.mode}
          act={act}
          busy={busy}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === 'tag' && (
        <TagEditor tag={editor.tag} act={act} busy={busy} onClose={() => setEditor(null)} />
      )}
    </DialogFeedback.Provider>
  );
}

type FilterProps = { value: string; onChange: (value: string) => void };

function Search({ label, value, onChange }: FilterProps & { label: string }) {
  return (
    <TextInput
      label={label}
      isLabelHidden
      placeholder={label}
      value={value}
      onChange={onChange}
      hasClear
      containerClassName="photo-search"
    />
  );
}

function GenreFilter({ value, onChange }: FilterProps) {
  return (
    <Select label={s.genre} value={value} onChange={onChange}>
      <option value="">{s.allGenres}</option>
      {Object.entries(genreNames).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </Select>
  );
}
