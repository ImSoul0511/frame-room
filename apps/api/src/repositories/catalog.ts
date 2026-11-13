import type {
  ExploreQuery,
  PublicPortfolio,
  PublicReview,
  Provider,
  Service,
  Tag,
} from '../schemas/catalog.js';
import type { Transaction } from './database.js';

export type ProviderType = 'photographer' | 'studio';

/**
 * Ép kiểu các cột số (numeric/bigint từ pg có thể trả về dạng string) để khớp providerSchema.
 */
function coerceProvider(row: Provider): Provider {
  return {
    ...row,
    genres: row.genres ?? [],
    styles: row.styles ?? [],
    priceFrom: row.priceFrom !== null && row.priceFrom !== undefined ? Number(row.priceFrom) : null,
    ratingAvg: row.ratingAvg !== null && row.ratingAvg !== undefined ? Number(row.ratingAvg) : null,
    reviewCount: Number(row.reviewCount ?? 0),
  };
}

function coerceService(row: Service): Service {
  return {
    ...row,
    durationMinutes: Number(row.durationMinutes),
    price: Number(row.price),
    photoCount: Number(row.photoCount),
    retouchedCount: Number(row.retouchedCount),
  };
}

/** Tìm kiếm danh sách provider cho GET /v1/explore với bộ lọc và phân trang. */
export async function discoverProviders(
  tx: Transaction,
  filters: ExploreQuery,
): Promise<Provider[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.genre) {
    values.push(filters.genre);
    conditions.push(`$${values.length} = any(genres)`);
  }
  if (filters.city) {
    values.push(filters.city);
    conditions.push(`lower(city) = lower($${values.length})`);
  }
  if (filters.district) {
    values.push(filters.district);
    conditions.push(`lower(district) = lower($${values.length})`);
  }
  if (filters.priceMax !== undefined) {
    values.push(filters.priceMax);
    conditions.push(`(price_from is not null and price_from <= $${values.length})`);
  }

  const limit = filters.pageSize;
  const offset = (filters.page - 1) * filters.pageSize;
  values.push(limit, offset);

  const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
  const rows = await tx.rows<Provider>(
    `select id, type, display_name, bio, city, district, genres, styles, price_from, rating_avg, review_count
     from providers
     ${where}
     order by rating_avg desc nulls last, review_count desc, display_name asc
     limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return rows.map(coerceProvider);
}

/** Lấy đường dẫn ảnh bìa đầu tiên của một provider từ các portfolio đã publish. */
export async function findProviderCoverPath(
  tx: Transaction,
  providerId: string,
): Promise<string | undefined> {
  const row = await tx.optional<{ storagePath: string }>(
    `select i.storage_path
     from portfolio_images i
     join portfolios po on po.id = i.portfolio_id
     where coalesce(po.photographer_id, po.studio_id) = $1
       and po.status = 'published'
       and po.deleted_at is null
       and not i.is_hidden
     order by i.sort_order
     limit 1`,
    [providerId],
  );
  return row?.storagePath;
}

/** Danh sách tối đa 50 provider theo loại (photographer | studio) cho GET /v1/photographers và /v1/studios. */
export async function listProvidersByType(
  tx: Transaction,
  type: ProviderType,
): Promise<Provider[]> {
  const rows = await tx.rows<Provider>(
    `select id, type, display_name, bio, city, district, genres, styles, price_from, rating_avg, review_count
     from providers
     where type = $1
     order by display_name
     limit 50`,
    [type],
  );
  return rows.map(coerceProvider);
}

/** Lấy 1 provider theo id và type (trả undefined nếu không có hoặc bị ẩn). */
export async function findProviderById(
  tx: Transaction,
  type: ProviderType,
  id: string,
): Promise<Provider | undefined> {
  const row = await tx.optional<Provider>(
    `select id, type, display_name, bio, city, district, genres, styles, price_from, rating_avg, review_count
     from providers
     where id = $1 and type = $2`,
    [id, type],
  );
  return row ? coerceProvider(row) : undefined;
}

/** Lấy danh sách các gói dịch vụ đang active của provider. */
export async function listActiveServicesByProvider(
  tx: Transaction,
  type: ProviderType,
  providerId: string,
): Promise<Service[]> {
  const column = type === 'studio' ? 'studio_id' : 'photographer_id';
  const rows = await tx.rows<Service>(
    `select id, name, description, genre, duration_minutes, price, photo_count, retouched_count, is_active, owner_type, photographer_id, studio_id
     from services
     where ${column} = $1 and is_active and deleted_at is null
     order by price`,
    [providerId],
  );
  return rows.map(coerceService);
}

/** Lấy danh sách các portfolio đã publish của provider. */
export async function listPublishedPortfoliosByProvider(
  tx: Transaction,
  type: ProviderType,
  providerId: string,
): Promise<PublicPortfolio[]> {
  const column = type === 'studio' ? 'studio_id' : 'photographer_id';
  return tx.rows<PublicPortfolio>(
    `select id, title, description, genre, status, owner_type, photographer_id, studio_id, published_at, created_at, updated_at
     from portfolios
     where ${column} = $1 and status = 'published' and deleted_at is null
     order by published_at desc nulls last`,
    [providerId],
  );
}

/** Lấy ảnh đầu tiên không bị ẩn của một portfolio để làm cover. */
export async function findPortfolioCoverPath(
  tx: Transaction,
  portfolioId: string,
): Promise<string | undefined> {
  const row = await tx.optional<{ storagePath: string }>(
    `select storage_path
     from portfolio_images
     where portfolio_id = $1 and not is_hidden
     order by sort_order
     limit 1`,
    [portfolioId],
  );
  return row?.storagePath;
}

/** Lấy danh sách tối đa 50 đánh giá hiển thị công khai của provider. */
export async function listVisibleReviewsByProvider(
  tx: Transaction,
  type: ProviderType,
  providerId: string,
): Promise<PublicReview[]> {
  const column = type === 'studio' ? 'studio_id' : 'photographer_id';
  const rows = await tx.rows<PublicReview>(
    `select r.id, r.booking_id, r.author_id, p.display_name as author_name, r.photographer_id, r.studio_id, r.rating, r.comment, r.created_at, r.updated_at
     from reviews r
     join profiles p on p.id = r.author_id
     where r.${column} = $1 and not r.is_hidden and r.deleted_at is null
     order by r.created_at desc
     limit 50`,
    [providerId],
  );
  return rows.map((r) => ({ ...r, rating: Number(r.rating) }));
}

/** Lấy toàn bộ danh sách tags theo kind và name. */
export async function listTags(tx: Transaction): Promise<Tag[]> {
  return tx.rows<Tag>('select id, name, slug, kind from tags order by kind, name');
}
