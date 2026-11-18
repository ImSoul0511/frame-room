import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Empty, Icon } from './controls';
import { categoryNames, genreNames, s } from './strings';
import { isInbox, moveId, ordered, type Album, type Dataset, type Photo, type Tag } from './types';

export function AlbumGrid({
  albums,
  images,
  ownerNames,
  disabled,
  onOpen,
  onEdit,
  onAssign,
  onArchive,
  onOrder,
  emptyAction,
}: {
  albums: Album[];
  images: Photo[];
  ownerNames: ReadonlyMap<string, string>;
  disabled: boolean;
  onOpen: (id: string) => void;
  onEdit: (album: Album) => void;
  onAssign?: (album: Album) => void;
  onArchive: (album: Album) => void;
  onOrder?: (ids: string[]) => void;
  emptyAction?: ReactNode;
}) {
  if (!albums.length)
    return <Empty title={s.noAlbums} hint={s.noAlbumsHint} action={emptyAction} />;
  const ids = albums.map((album) => album.id);
  return (
    <div className="album-grid">
      {albums.map((album, index) => {
        const photos = ordered(
          images.filter((image) => image.portfolio_id === album.id && !image.is_hidden),
        );
        const reviewed = photos.filter((image) => image.label_status === 'reviewed').length;
        return (
          <article
            className="album-card"
            key={album.id}
            draggable={!disabled && !!onOrder}
            onDragStart={(event) =>
              event.dataTransfer.setData('application/x-dataset-album', album.id)
            }
            onDragOver={(event) => {
              if (onOrder && !disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from = event.dataTransfer.getData('application/x-dataset-album');
              if (from && from !== album.id && onOrder && !disabled)
                onOrder(moveId(ids, from, album.id));
            }}
          >
            <button
              type="button"
              className="album-cover"
              onClick={() => onOpen(album.id)}
              title={album.title}
              disabled={!!album.deleted_at}
            >
              {photos[0] ? (
                <img src={photos[0].url} alt={album.title} loading="lazy" draggable={false} />
              ) : (
                <div className="blank-cover">
                  <Icon name="folder" size={42} />
                </div>
              )}
              <span className={`status-badge ${album.status}`}>
                {!album.photographer_id
                  ? s.unassignedSet
                  : album.status === 'published'
                    ? s.published
                    : album.status === 'hidden'
                      ? s.hidden
                      : s.draft}
              </span>
            </button>
            <div className="album-card-body">
              <div className="album-kicker">
                {genreNames[album.genre] ?? album.genre}
                {isInbox(album) && <span>{s.inbox}</span>}
                {album.photographer_id && !isInbox(album) && (
                  <span>{ownerNames.get(album.photographer_id)}</span>
                )}
              </div>
              <button
                type="button"
                className="album-title"
                onClick={() => onOpen(album.id)}
                disabled={!!album.deleted_at}
              >
                {album.title}
              </button>
              {album.description && <p className="album-description">{album.description}</p>}
              <div className="album-meta">
                <span>
                  {photos.length} {s.photos}
                </span>
                <span>
                  <i className="review-dot" />
                  {reviewed}/{photos.length} {s.reviewed.toLowerCase()}
                </span>
              </div>
              {onAssign && !album.photographer_id && !album.deleted_at && (
                <Button
                  label={s.assignSet}
                  variant="secondary"
                  size="sm"
                  width="100%"
                  isDisabled={disabled || !photos.length}
                  onClick={() => onAssign(album)}
                />
              )}
              <div className="album-card-actions">
                <div className="order-buttons">
                  {onOrder && (
                    <>
                      <Button
                        label={s.previous}
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        icon={<Icon name="back" size={15} />}
                        isDisabled={disabled || index === 0}
                        onClick={() => onOrder(moveId(ids, album.id, ids[index - 1]))}
                      />
                      <Button
                        label={s.next}
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        icon={<Icon name="arrow" size={15} />}
                        isDisabled={disabled || index === albums.length - 1}
                        onClick={() => onOrder(moveId(ids, album.id, ids[index + 1]))}
                      />
                    </>
                  )}
                </div>
                {!album.deleted_at && (
                  <Button
                    label={s.editAlbum}
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    icon={<Icon name="edit" size={16} />}
                    isDisabled={disabled}
                    onClick={() => onEdit(album)}
                  />
                )}
                <Button
                  label={album.deleted_at ? s.restore : s.remove}
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  icon={<Icon name={album.deleted_at ? 'refresh' : 'trash'} size={16} />}
                  isDisabled={disabled}
                  onClick={() => onArchive(album)}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PhotoGrid({
  photos,
  data,
  selected,
  disabled,
  onSelect,
  onOpen,
  onOrder,
  onRestore,
  onDelete,
  showAlbum = false,
}: {
  photos: Photo[];
  data: Dataset;
  selected: string[];
  disabled: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onOrder?: (ids: string[]) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
  showAlbum?: boolean;
}) {
  if (!photos.length)
    return (
      <Empty
        title={onRestore ? s.noTrash : s.noPhotos}
        hint={onRestore ? undefined : s.noPhotosHint}
      />
    );
  const ids = photos.map((image) => image.id);
  const byTag = new Map(data.tags.map((tag) => [tag.id, tag]));
  const byAlbum = new Map(data.portfolios.map((album) => [album.id, album]));
  const tagMap = new Map<string, Tag[]>();
  for (const assignment of data.assignments) {
    const tag = byTag.get(assignment.tag_id);
    if (tag)
      tagMap.set(assignment.portfolio_image_id, [
        ...(tagMap.get(assignment.portfolio_image_id) ?? []),
        tag,
      ]);
  }
  return (
    <div className="photo-grid">
      {photos.map((photo, index) => {
        const chosen = selected.includes(photo.id);
        const tags = tagMap.get(photo.id) ?? [];
        const album = byAlbum.get(photo.portfolio_id);
        return (
          <article
            key={photo.id}
            className={`photo-card ${chosen ? 'chosen' : ''}`}
            draggable={!disabled && !!onOrder}
            onDragStart={(event) =>
              event.dataTransfer.setData('application/x-dataset-image', photo.id)
            }
            onDragOver={(event) => {
              if (onOrder && !disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from = event.dataTransfer.getData('application/x-dataset-image');
              if (from && from !== photo.id && onOrder && !disabled)
                onOrder(moveId(ids, from, photo.id));
            }}
          >
            <div className="photo-frame">
              <button
                type="button"
                className="photo-open"
                onClick={() => onOpen(photo.id)}
                aria-label={`${s.openImage} ${index + 1}`}
              >
                <img
                  src={photo.url}
                  alt={
                    photo.caption ||
                    `${genreNames[photo.suggested_genre ?? ''] ?? s.photos} ${index + 1}`
                  }
                  loading="lazy"
                  draggable={false}
                />
              </button>
              {!onRestore && (
                <label className="photo-checkbox">
                  <input
                    type="checkbox"
                    checked={chosen}
                    disabled={disabled}
                    onChange={() => onSelect(photo.id)}
                    aria-label={`${s.selected} ${index + 1}`}
                  />
                  <span>
                    <Icon name="check" size={13} />
                  </span>
                </label>
              )}
              <span className={`annotation-badge ${photo.label_status}`}>
                {photo.label_status === 'reviewed' ? <Icon name="check" size={13} /> : <i />}
                {photo.label_status === 'reviewed'
                  ? s.reviewed
                  : photo.label_status === 'suggested'
                    ? s.suggested
                    : s.unlabeled}
              </span>
            </div>
            <div className="photo-card-body">
              <div className="photo-caption" title={photo.caption}>
                {photo.caption || <span>{s.photoDescriptionEmpty}</span>}
              </div>
              {showAlbum && album && (
                <div className="photo-album">{isInbox(album) ? s.inbox : album.title}</div>
              )}
              <div className="photo-tags">
                {tags.slice(0, 3).map((tag) => (
                  <span key={tag.id}>{tag.name_vi || tag.name}</span>
                ))}
                {tags.length > 3 && <span>+{tags.length - 3}</span>}
              </div>
              <div className="photo-bottom">
                <small>
                  {photo.width} × {photo.height}
                </small>
                {onRestore ? (
                  <div className="order-buttons">
                    <Button
                      label={s.restore}
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      icon={<Icon name="refresh" size={14} />}
                      isDisabled={disabled}
                      onClick={() => onRestore(photo.id)}
                    />
                    <Button
                      label={s.deletePhoto}
                      size="sm"
                      variant="destructive"
                      isIconOnly
                      icon={<Icon name="trash" size={14} />}
                      isDisabled={disabled || !onDelete}
                      onClick={() => onDelete?.(photo.id)}
                    />
                  </div>
                ) : onOrder ? (
                  <div className="order-buttons">
                    <Button
                      label={s.previous}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="back" size={13} />}
                      isDisabled={disabled || index === 0}
                      onClick={() => onOrder(moveId(ids, photo.id, ids[index - 1]))}
                    />
                    <Button
                      label={s.next}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="arrow" size={13} />}
                      isDisabled={disabled || index === photos.length - 1}
                      onClick={() => onOrder(moveId(ids, photo.id, ids[index + 1]))}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function TagLibrary({
  data,
  query,
  category,
  includeArchived,
  disabled,
  onEdit,
  onArchive,
}: {
  data: Dataset;
  query: string;
  category: string;
  includeArchived: boolean;
  disabled: boolean;
  onEdit: (tag: Tag) => void;
  onArchive: (tag: Tag) => void;
}) {
  const filtered = data.tags.filter(
    (tag) =>
      (includeArchived || tag.is_active) &&
      (!category || tag.category === category) &&
      [tag.name_vi, tag.name, tag.slug, ...tag.aliases]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const counts = new Map<string, number>();
  data.assignments.forEach((assignment) =>
    counts.set(assignment.tag_id, (counts.get(assignment.tag_id) ?? 0) + 1),
  );
  if (!filtered.length) return <Empty title={s.noTags} />;
  return (
    <div className="tag-library">
      {[...filtered]
        .sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            (a.name_vi || a.name).localeCompare(b.name_vi || b.name),
        )
        .map((tag) => (
          <article key={tag.id} className={`tag-card ${tag.is_active ? '' : 'retired'}`}>
            <div className="tag-card-top">
              <span className="category-label">{categoryNames[tag.category]}</span>
              <span>
                {counts.get(tag.id) ?? 0} {s.tagUsed}
              </span>
            </div>
            <h3>{tag.name_vi || tag.name}</h3>
            <code>{tag.slug}</code>
            <p>{tag.definition_vi || tag.definition_en}</p>
            {tag.aliases.length > 0 && <div className="tag-aliases">{tag.aliases.join(' · ')}</div>}
            <div className="tag-card-footer">
              <span className={tag.is_active ? 'active-tag-label' : 'inactive-tag-label'}>
                {tag.is_active ? s.active : s.inactive}
              </span>
              <Button
                label={s.editTag}
                size="sm"
                variant="ghost"
                isIconOnly
                icon={<Icon name="edit" size={16} />}
                isDisabled={disabled}
                onClick={() => onEdit(tag)}
              />
              <Button
                label={tag.is_active ? s.remove : s.restore}
                size="sm"
                variant="ghost"
                isIconOnly
                icon={<Icon name={tag.is_active ? 'trash' : 'refresh'} size={16} />}
                isDisabled={disabled}
                onClick={() => onArchive(tag)}
              />
            </div>
          </article>
        ))}
    </div>
  );
}
