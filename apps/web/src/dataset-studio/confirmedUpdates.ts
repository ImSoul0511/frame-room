import type { Album, Dataset, Photo } from './types';

export function confirmedUpdate(
  data: Dataset,
  action: string,
  payload: Record<string, unknown>,
): Dataset | undefined {
  const {
    id,
    caption,
    label_status,
    tag_ids,
    display_name,
    bio,
    city,
    title,
    description,
    genre,
    status,
    photographer_id,
  } = payload;
  if (action === 'images.delete' && Array.isArray(payload.ids)) {
    const ids = new Set(payload.ids);
    return {
      ...data,
      images: data.images.filter((image) => !ids.has(image.id)),
      assignments: data.assignments.filter((link) => !ids.has(link.portfolio_image_id)),
    };
  }
  if (typeof id !== 'string') return;
  if (action === 'image.save' && typeof caption === 'string' && Array.isArray(tag_ids)) {
    return {
      ...data,
      images: data.images.map((image) =>
        image.id === id
          ? { ...image, caption, label_status: label_status as Photo['label_status'] }
          : image,
      ),
      assignments: [
        ...data.assignments.filter((link) => link.portfolio_image_id !== id),
        ...tag_ids.map((tagId: string) => ({
          portfolio_image_id: id,
          tag_id: tagId,
          source: 'manual',
        })),
      ],
    };
  }
  if (
    action === 'photographer.save' &&
    typeof display_name === 'string' &&
    typeof bio === 'string' &&
    typeof city === 'string'
  ) {
    return {
      ...data,
      photographers: data.photographers.map((profile) =>
        profile.id === id ? { ...profile, display_name: display_name.trim(), bio, city } : profile,
      ),
    };
  }
  if (
    (action === 'album.save' || action === 'set.save') &&
    typeof title === 'string' &&
    typeof description === 'string' &&
    typeof genre === 'string'
  ) {
    return {
      ...data,
      portfolios: data.portfolios.map((album) =>
        album.id === id
          ? {
              ...album,
              title: title.trim(),
              description,
              genre,
              status: action === 'album.save' ? (status as Album['status']) : album.status,
            }
          : album,
      ),
    };
  }
  if (action === 'set.assign' && typeof photographer_id === 'string') {
    const sortOrder =
      data.portfolios.reduce(
        (last, album) =>
          album.photographer_id === photographer_id ? Math.max(last, album.sort_order ?? 0) : last,
        -1,
      ) + 1;
    return {
      ...data,
      portfolios: data.portfolios.map((album) =>
        album.id === id && album.photographer_id !== photographer_id
          ? { ...album, photographer_id, sort_order: sortOrder }
          : album,
      ),
    };
  }
}
