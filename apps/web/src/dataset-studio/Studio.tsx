import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyAction, fetchDataset } from './api';
import { DialogFeedback, Empty, Icon, Select } from './controls';
import {
  AlbumEditor,
  BulkTagEditor,
  ImageEditor,
  MoveEditor,
  ProfileEditor,
  TagEditor,
} from './editors';
import { AlbumGrid, PhotoGrid, TagLibrary } from './library';
import { categoryNames, genreNames, s } from './strings';
import { moveId, ordered, type Act, type Album, type Tag } from './types';

type View = 'albums' | 'photos' | 'tags' | 'trash';
type Editor =
  | { kind: 'album'; album?: Album; thenMove?: boolean }
  | { kind: 'profile' }
  | { kind: 'image'; id: string }
  | { kind: 'move'; target?: string }
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
  const [profileId, setProfileId] = useState<string | null>(null);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [view, setView] = useState<View>('albums');
  const [editor, setEditorState] = useState<Editor>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [profileQuery, setProfileQuery] = useState('');
  const [photoQuery, setPhotoQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [tagCategory, setTagCategory] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [showInactiveTags, setShowInactiveTags] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const setEditor = (value: Editor) => {
    if (value) setNotice(null);
    setEditorState(value);
  };
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload: Record<string, unknown> }) =>
      applyAction(action, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['dataset-studio'] });
      setNotice({ text: s.saved, error: false });
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

  if (!query.data)
    return (
      <div className="studio-loading">
        <div className="brand-mark">
          <Icon name="grid" size={27} />
        </div>
        <h1>{s.studio}</h1>
        {query.isError ? (
          <>
            <p role="alert">{s.loadError}</p>
            <Button
              label={s.retry}
              onClick={() => {
                void query.refetch();
              }}
            />
          </>
        ) : (
          <>
            <span className="loading-line" />
            <p role="status">{s.loading}</p>
          </>
        )}
      </div>
    );
  const data = query.data;
  const busy = mutation.isPending;
  const disabled = busy || !data.ready || data.read_only;
  const profiles = [...data.photographers].sort(
    (a, b) =>
      (a.dataset_sort_order ?? 0) - (b.dataset_sort_order ?? 0) ||
      a.display_name.localeCompare(b.display_name),
  );
  const visibleProfiles = profiles.filter(
    (p) =>
      (showHidden || !p.is_hidden) &&
      p.display_name.toLowerCase().includes(profileQuery.toLowerCase()),
  );
  const profile =
    profiles.find((p) => p.id === profileId && (showHidden || !p.is_hidden)) ??
    profiles.find((p) => !p.is_hidden) ??
    profiles[0];
  const allAlbums = profile ? data.portfolios.filter((a) => a.photographer_id === profile.id) : [];
  const albums = ordered(allAlbums.filter((a) => !a.deleted_at));
  const activeAlbum = albums.find((a) => a.id === albumId);
  const allProfileImages = data.images.filter((photo) =>
    allAlbums.some((a) => a.id === photo.portfolio_id),
  );
  const activeImages = allProfileImages.filter(
    (photo) => !photo.is_hidden && albums.some((a) => a.id === photo.portfolio_id),
  );
  const reviewedCount = activeImages.filter((p) => p.label_status === 'reviewed').length;
  const deletedImages = allProfileImages.filter((photo) => photo.is_hidden);
  const photoWords = (id: string) =>
    data.assignments
      .filter((a) => a.portfolio_image_id === id)
      .map((a) => {
        const tag = data.tags.find((tag) => tag.id === a.tag_id);
        return tag ? [tag.name, tag.name_vi, ...tag.aliases].join(' ') : '';
      })
      .join(' ');
  const photos = ordered(
    activeImages.filter(
      (photo) =>
        (!activeAlbum || photo.portfolio_id === activeAlbum.id) &&
        (!stateFilter || photo.label_status === stateFilter) &&
        (!tagFilter ||
          data.assignments.some(
            (a) => a.portfolio_image_id === photo.id && a.tag_id === tagFilter,
          )) &&
        [photo.caption, photo.suggested_genre, photoWords(photo.id)]
          .join(' ')
          .toLowerCase()
          .includes(photoQuery.toLowerCase()),
    ),
  );
  const canOrder = !!activeAlbum && !stateFilter && !tagFilter && !photoQuery && view === 'photos';
  const navigate = (next: View) => {
    setView(next);
    setAlbumId(null);
    setSelected([]);
    setPhotoQuery('');
    setStateFilter('');
    setTagFilter('');
  };
  const openProfile = (id: string) => {
    setProfileId(id);
    navigate('albums');
  };
  const selectPhoto = (id: string) =>
    setSelected((values) =>
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
  const archiveAlbum = (album: Album) => {
    if (album.deleted_at || window.confirm(s.confirmArchive))
      perform('album.archive', { id: album.id, archived: !album.deleted_at }, () =>
        setAlbumId(null),
      );
  };
  const archiveSelection = () => {
    if (window.confirm(s.confirmPhotosArchive))
      perform('images.archive', { ids: selected, archived: true }, () => setSelected([]));
  };
  const profileCounts = (id: string) =>
    data.images.filter(
      (photo) =>
        !photo.is_hidden &&
        data.portfolios.some(
          (a) => a.id === photo.portfolio_id && a.photographer_id === id && !a.deleted_at,
        ),
    ).length;
  const imageInEditor =
    editor?.kind === 'image' ? data.images.find((image) => image.id === editor.id) : undefined;
  const editorImages = view === 'trash' ? deletedImages : photos;
  const editorIndex = imageInEditor
    ? editorImages.findIndex((image) => image.id === imageInEditor.id)
    : -1;

  return (
    <DialogFeedback.Provider value={notice?.error ? notice.text : null}>
      <div className="studio-shell">
        <aside className="studio-sidebar">
          <div className="studio-brand">
            <div className="brand-mark">
              <Icon name="grid" size={23} />
            </div>
            <div>
              <strong>{s.brand}</strong>
              <span>{s.studio}</span>
            </div>
          </div>
          <div className="sidebar-heading">
            <span>{s.collection}</span>
            <span>{profiles.length}</span>
          </div>
          <div className="sidebar-search">
            <TextInput
              label={s.searchProfiles}
              isLabelHidden
              placeholder={s.searchProfiles}
              value={profileQuery}
              onChange={setProfileQuery}
              size="sm"
              hasClear
            />
          </div>
          <nav className="profile-list" aria-label={s.profiles}>
            {visibleProfiles.map((p, index) => (
              <div
                key={p.id}
                className={`profile-row ${profile?.id === p.id ? 'active' : ''} ${p.is_hidden ? 'archived' : ''}`}
              >
                <button type="button" className="profile-select" onClick={() => openProfile(p.id)}>
                  <span className={`profile-avatar color-${p.genres[0]}`}>
                    {p.display_name
                      .split(' ')
                      .slice(-2)
                      .map((part) => part[0])
                      .join('')}
                  </span>
                  <span>
                    <strong>{p.display_name}</strong>
                    <small>{genreNames[p.genres[0]] ?? p.genres[0]}</small>
                  </span>
                  <b>{profileCounts(p.id)}</b>
                </button>
                <div className="profile-order">
                  <button
                    type="button"
                    aria-label={s.previous}
                    disabled={disabled || index === 0}
                    onClick={() =>
                      perform('photographer.order', {
                        ids: moveId(
                          visibleProfiles.map((p) => p.id),
                          p.id,
                          visibleProfiles[index - 1].id,
                        ),
                      })
                    }
                  >
                    <Icon name="up" size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={s.next}
                    disabled={disabled || index === visibleProfiles.length - 1}
                    onClick={() =>
                      perform('photographer.order', {
                        ids: moveId(
                          visibleProfiles.map((p) => p.id),
                          p.id,
                          visibleProfiles[index + 1].id,
                        ),
                      })
                    }
                  >
                    <Icon name="down" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </nav>
          <label className="sidebar-hidden">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(event) => setShowHidden(event.target.checked)}
            />
            {s.showHiddenProfiles}
          </label>
          <div className="sidebar-footer">
            <span className="connection-dot" />
            <div>
              <strong>{s.ready}</strong>
              <small>{s.local}</small>
            </div>
          </div>
        </aside>

        <main className="studio-main">
          <header className="studio-topbar">
            <div className="breadcrumb">
              {s.studio}
              <span>/</span>
              <strong>{view === 'tags' ? s.tags : (profile?.display_name ?? s.profiles)}</strong>
            </div>
            <div className="top-actions">
              <span className="global-count">
                {data.images.length} {s.photos}
                <span>·</span>
                {profiles.length} {s.profiles.toLowerCase()}
              </span>
              <Button
                label={query.isFetching ? s.refreshing : s.refresh}
                variant="ghost"
                size="sm"
                icon={<Icon name="refresh" size={16} />}
                isDisabled={busy || query.isFetching}
                onClick={() => {
                  void query.refetch();
                }}
              />
            </div>
          </header>
          <div className="studio-content">
            {(!data.ready || data.read_only) && (
              <div className="setup-banner" role="status">
                <Icon name="folder" size={24} />
                <div>
                  <strong>{data.read_only ? s.readOnly : s.migrationNeeded}</strong>
                  {!data.ready && (
                    <>
                      <code>{data.migration}</code>
                      <p>{s.migrationHint}</p>
                    </>
                  )}
                </div>
              </div>
            )}
            {notice && (
              <div
                role={notice.error ? 'alert' : 'status'}
                className={`notice ${notice.error ? 'error' : ''}`}
              >
                <Icon name={notice.error ? 'close' : 'check'} />
                <span>{notice.text}</span>
                <button type="button" aria-label={s.close} onClick={() => setNotice(null)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}
            {!profile ? (
              <Empty title={s.noProfiles} hint={s.noProfilesHint} />
            ) : (
              <>
                <section className="profile-hero">
                  <div className="profile-heading">
                    <p className="eyebrow">
                      {genreNames[profile.genres[0]] ?? profile.genres[0]} / {s.collection}
                    </p>
                    <h1>{view === 'tags' ? s.tags : profile.display_name}</h1>
                    <p className="profile-description">
                      {view === 'tags' ? s.tagHelp : profile.bio || s.profileHelp}
                    </p>
                    <div className="profile-subline">
                      <span>{profile.city}</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setEditor({ kind: 'profile' })}
                      >
                        <Icon name="edit" size={14} />
                        {s.editProfile}
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (profile.is_hidden || window.confirm(s.confirmArchive))
                            perform(
                              'photographer.archive',
                              { id: profile.id, archived: !profile.is_hidden },
                              () => {
                                if (!profile.is_hidden) setProfileId(null);
                              },
                            );
                        }}
                      >
                        {profile.is_hidden ? s.restoreProfile : s.archiveProfile}
                      </button>
                    </div>
                  </div>
                  <div className="profile-stats">
                    <div>
                      <strong>{activeImages.length}</strong>
                      <span>{s.photos}</span>
                    </div>
                    <div>
                      <strong>{albums.length}</strong>
                      <span>{s.albums}</span>
                    </div>
                    <div className="review-stat">
                      <strong>
                        {activeImages.length
                          ? Math.round((reviewedCount / activeImages.length) * 100)
                          : 0}
                        <small>%</small>
                      </strong>
                      <span>{s.reviewed}</span>
                      <div className="progress-track">
                        <i
                          style={{
                            width: `${activeImages.length ? (reviewedCount / activeImages.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
                <div className="view-nav">
                  <nav aria-label={s.collection}>
                    {(
                      [
                        ['albums', s.allAlbums, 'folder'],
                        ['photos', s.allPhotos, 'image'],
                        ['tags', s.tags, 'tag'],
                        ['trash', s.trash, 'trash'],
                      ] as const
                    ).map(([key, label, icon]) => (
                      <button
                        type="button"
                        key={key}
                        className={view === key ? 'active' : ''}
                        onClick={() => navigate(key)}
                      >
                        <Icon name={icon} size={17} />
                        {label}
                        {key === 'trash' &&
                          deletedImages.length + allAlbums.filter((a) => a.deleted_at).length >
                            0 && (
                            <b>
                              {deletedImages.length + allAlbums.filter((a) => a.deleted_at).length}
                            </b>
                          )}
                      </button>
                    ))}
                  </nav>
                  <Button
                    label={view === 'tags' ? s.newTag : s.newAlbum}
                    variant="primary"
                    icon={<Icon name="plus" />}
                    isDisabled={disabled || (view !== 'tags' && profile.is_hidden)}
                    onClick={() => setEditor(view === 'tags' ? { kind: 'tag' } : { kind: 'album' })}
                  />
                </div>

                {view === 'albums' && (
                  <>
                    <div className="section-title">
                      <div>
                        <h2>
                          {s.allAlbums}
                          <span>{albums.length}</span>
                        </h2>
                        <p>{s.albumHelp}</p>
                      </div>
                      <small>{s.dragAlbum}</small>
                    </div>
                    <AlbumGrid
                      albums={albums}
                      images={data.images}
                      disabled={disabled}
                      onOpen={(id) => {
                        setAlbumId(id);
                        setView('photos');
                        setSelected([]);
                      }}
                      onEdit={(album) => setEditor({ kind: 'album', album })}
                      onArchive={archiveAlbum}
                      onOrder={(ids) =>
                        perform('album.order', { ids, photographer_id: profile.id })
                      }
                    />
                  </>
                )}

                {view === 'photos' && (
                  <>
                    <div className="section-title">
                      <div>
                        {activeAlbum && (
                          <button
                            type="button"
                            className="back-link"
                            onClick={() => navigate('albums')}
                          >
                            <Icon name="back" size={14} />
                            {s.allAlbums}
                          </button>
                        )}
                        <h2>
                          {activeAlbum?.title ?? s.allPhotos}
                          <span>{photos.length}</span>
                        </h2>
                        <p>{activeAlbum?.description || s.allPhotosHelp}</p>
                      </div>
                      {activeAlbum && (
                        <Button
                          label={s.editAlbum}
                          variant="secondary"
                          size="sm"
                          icon={<Icon name="edit" size={15} />}
                          isDisabled={disabled}
                          onClick={() => setEditor({ kind: 'album', album: activeAlbum })}
                        />
                      )}
                    </div>
                    <div className="photo-filters">
                      <TextInput
                        label={s.searchPhotos}
                        isLabelHidden
                        placeholder={s.searchPhotos}
                        value={photoQuery}
                        onChange={setPhotoQuery}
                        hasClear
                        containerClassName="photo-search"
                      />
                      <Select
                        label={s.annotationState}
                        value={stateFilter}
                        onChange={setStateFilter}
                      >
                        <option value="">{s.allStates}</option>
                        <option value="unlabeled">{s.unlabeled}</option>
                        <option value="reviewed">{s.reviewed}</option>
                        <option value="suggested">{s.suggested}</option>
                      </Select>
                      <Select label={s.tags} value={tagFilter} onChange={setTagFilter}>
                        <option value="">{s.noTagFilter}</option>
                        {data.tags
                          .filter((tag) => tag.is_active)
                          .map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name_vi || tag.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <div className="selection-line">
                      <label>
                        <input
                          type="checkbox"
                          checked={!!photos.length && photos.every((p) => selected.includes(p.id))}
                          disabled={disabled || !photos.length}
                          onChange={() =>
                            setSelected((current) =>
                              photos.every((p) => current.includes(p.id))
                                ? current.filter((id) => !photos.some((p) => p.id === id))
                                : [...new Set([...current, ...photos.map((p) => p.id)])],
                            )
                          }
                        />
                        {s.selectAll}
                      </label>
                      <p>{canOrder ? s.orderHint : s.filterOrderHint}</p>
                    </div>
                    <PhotoGrid
                      photos={photos}
                      data={data}
                      selected={selected}
                      disabled={disabled}
                      onSelect={selectPhoto}
                      onOpen={(id) => setEditor({ kind: 'image', id })}
                      onOrder={
                        canOrder
                          ? (ids) => perform('images.order', { ids, portfolio_id: activeAlbum!.id })
                          : undefined
                      }
                    />
                  </>
                )}

                {view === 'tags' && (
                  <>
                    <div className="section-title">
                      <div>
                        <h2>
                          {s.tags}
                          <span>{data.tags.filter((tag) => tag.is_active).length}</span>
                        </h2>
                        <p>{s.tagHelp}</p>
                      </div>
                    </div>
                    <div className="photo-filters tag-filters">
                      <TextInput
                        label={s.searchTags}
                        isLabelHidden
                        placeholder={s.searchTags}
                        value={tagQuery}
                        onChange={setTagQuery}
                        hasClear
                        containerClassName="photo-search"
                      />
                      <Select label={s.category} value={tagCategory} onChange={setTagCategory}>
                        <option value="">{s.allCategories}</option>
                        {Object.entries(categoryNames).map(([key, label]) => (
                          <option value={key} key={key}>
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
                      includeArchived={showInactiveTags}
                      disabled={disabled}
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
                      <h2>
                        {s.deletedAlbums}
                        <span>{allAlbums.filter((a) => a.deleted_at).length}</span>
                      </h2>
                    </div>
                    <AlbumGrid
                      albums={ordered(allAlbums.filter((a) => !!a.deleted_at))}
                      images={data.images}
                      disabled={disabled}
                      onOpen={() => {}}
                      onEdit={() => {}}
                      onArchive={archiveAlbum}
                    />
                    <div className="section-title trash-images-title">
                      <h2>
                        {s.deletedPhotos}
                        <span>{deletedImages.length}</span>
                      </h2>
                    </div>
                    <PhotoGrid
                      photos={ordered(deletedImages)}
                      data={data}
                      selected={[]}
                      disabled={disabled}
                      onSelect={() => {}}
                      onOpen={(id) => setEditor({ kind: 'image', id })}
                      onRestore={(id) => perform('images.archive', { ids: [id], archived: false })}
                    />
                  </>
                )}
              </>
            )}
          </div>
          {view === 'photos' && selected.length > 0 && (
            <div className="selection-toolbar">
              <strong>
                {selected.length}
                <span>{s.selected}</span>
              </strong>
              <div className="selection-toolbar-buttons">
                <Button
                  label={s.movePhotos}
                  size="sm"
                  icon={<Icon name="folder" size={16} />}
                  isDisabled={disabled}
                  onClick={() => setEditor({ kind: 'move' })}
                />
                <Button
                  label={s.addTags}
                  size="sm"
                  icon={<Icon name="tag" size={16} />}
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
                  icon={<Icon name="check" size={16} />}
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
                  variant="destructive"
                  isIconOnly
                  icon={<Icon name="trash" size={16} />}
                  isDisabled={disabled}
                  onClick={archiveSelection}
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

        {profile && editor?.kind === 'album' && (
          <AlbumEditor
            key={editor.album?.id ?? 'new'}
            album={editor.album}
            profile={profile}
            act={act}
            busy={busy}
            onClose={() => setEditor(null)}
            onDone={(id) => {
              if (editor.thenMove) setEditor({ kind: 'move', target: id });
              else {
                setEditor(null);
                setAlbumId(id);
                setView('photos');
                setSelected([]);
              }
            }}
          />
        )}
        {profile && editor?.kind === 'profile' && (
          <ProfileEditor
            key={profile.id}
            profile={profile}
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
            readOnly={disabled && !busy}
            onClose={() => setEditor(null)}
            onNavigate={(id) => setEditor({ kind: 'image', id })}
            previous={editorImages[editorIndex - 1]?.id}
            next={editorImages[editorIndex + 1]?.id}
          />
        )}
        {editor?.kind === 'move' && (
          <MoveEditor
            data={data}
            selected={selected}
            currentAlbum={activeAlbum?.id}
            initialTarget={editor.target}
            act={act}
            busy={busy}
            onClose={() => setEditor(null)}
            onMoved={() => {
              setEditor(null);
              setSelected([]);
            }}
            onCreate={() => setEditor({ kind: 'album', thenMove: true })}
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
          <TagEditor
            key={editor.tag?.id ?? 'new-tag'}
            tag={editor.tag}
            act={act}
            busy={busy}
            onClose={() => setEditor(null)}
          />
        )}
      </div>
    </DialogFeedback.Provider>
  );
}
