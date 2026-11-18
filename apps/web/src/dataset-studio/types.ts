export type Photographer = {
  id: string;
  display_name: string;
  bio: string;
  city: string;
  genres: string[];
  is_hidden: boolean;
  dataset_sort_order?: number;
};
export type Album = {
  id: string;
  photographer_id: string | null;
  title: string;
  description: string;
  genre: string;
  status: 'draft' | 'published' | 'hidden';
  deleted_at: string | null;
  sort_order?: number;
  created_at: string;
  dataset_key: string | null;
};
export type Photo = {
  id: string;
  portfolio_id: string;
  url: string;
  caption: string;
  width: number;
  height: number;
  is_hidden: boolean;
  label_status: 'unlabeled' | 'suggested' | 'reviewed';
  sort_order: number;
  created_at: string;
  suggested_genre: string | null;
};
export type Tag = {
  id: string;
  slug: string;
  name: string;
  name_vi: string | null;
  category: string;
  definition_vi: string | null;
  definition_en: string | null;
  aliases: string[];
  is_active: boolean;
};
export type Assignment = { portfolio_image_id: string; tag_id: string; source: string };
export type Dataset = {
  photographers: Photographer[];
  portfolios: Album[];
  images: Photo[];
  tags: Tag[];
  assignments: Assignment[];
  ready: boolean;
  delete_ready: boolean;
  read_only: boolean;
  migration: string;
  delete_migration: string;
  sets_ready: boolean;
  sets_migration: string;
};
export type Act = (action: string, payload: Record<string, unknown>) => Promise<{ id?: string }>;
export function isInbox(album: Album) {
  return /:inbox(?::rev:\d+)?$/.test(album.dataset_key ?? '');
}
export function ordered<T extends { id: string; sort_order?: number }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
  );
}
export function moveId(ids: string[], from: string, to: string): string[] {
  const result = [...ids];
  const previous = result.indexOf(from);
  const next = result.indexOf(to);
  if (previous < 0 || next < 0 || previous === next) return result;
  result.splice(previous, 1);
  result.splice(next, 0, from);
  return result;
}
