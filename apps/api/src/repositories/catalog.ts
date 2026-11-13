import type {
  ExploreQuery,
  MyStudio,
  Provider,
  PublicPortfolio,
  PublicReview,
  Service,
  Studio,
  StudioInput,
  StudioTeamMember,
  Tag,
  OwnedService,
  ServiceInput,
  OwnedPortfolio,
  PortfolioImageInput,
  PortfolioInput,
  PortfolioListQuery,
  MyInvitation,
  ServiceAddOn,
  ServiceAddOnInput,
  StudioInvitation,
  StudioInvitationInput,
  StudioResource,
  StudioResourceInput,
} from '../schemas/catalog.js';
import type { Transaction } from './database.js';

export type ProviderType = 'photographer' | 'studio';

/**
 *  Coerces Postgres numeric/bigint string columns into JS numbers to satisfy providerSchema.
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

/** Queries public providers for GET /v1/explore with optional filters and pagination. */
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

/** Finds the storage path of the first visible image across a provider's published portfolios. */
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

/** Lists up to 50 visible providers by type for GET /v1/photographers and GET /v1/studios. */
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

/** Finds a single visible provider by id and type. */
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

/** Lists active, non-deleted services offered by a provider. */
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

/** Lists published, non-deleted portfolios owned by a provider. */
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

/** Finds the storage path of the first visible image in a portfolio to use as its cover. */
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

/** Lists up to 50 visible reviews for a provider, joined with author display names. */
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

/** Lists all taxonomy tags ordered by kind and name. */
export async function listTags(tx: Transaction): Promise<Tag[]> {
  return tx.rows<Tag>('select id, name, slug, kind from tags order by kind, name');
}

// ---------- 102b: Studios & Team ----------

/** Checks whether the caller has an existing photographer profile (required to create a studio). */
export async function photographerExistsByUser(tx: Transaction, userId: string): Promise<boolean> {
  const row = await tx.optional<{ id: string }>('select id from photographers where user_id = $1', [
    userId,
  ]);
  return row !== undefined;
}

/** Checks whether the caller is an active manager of a non-deleted studio. */
export async function isStudioManager(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<boolean> {
  const row = await tx.optional<{ userId: string }>(
    `select m.user_id
     from studio_members m
     join studios s on s.id = m.studio_id
     where m.studio_id = $1
       and m.user_id = $2
       and m.role = 'manager'
       and s.deleted_at is null`,
    [studioId, userId],
  );
  return row !== undefined;
}

/** Lists active studios where the user is a member, including their role. */
export async function listStudiosByMember(tx: Transaction, userId: string): Promise<MyStudio[]> {
  return tx.rows<MyStudio>(
    `select s.id, s.name, s.description, s.city, s.district, s.address, s.genres,
            s.created_by, s.is_hidden, s.created_at, s.updated_at, m.role
     from studios s
     join studio_members m on m.studio_id = s.id
     where m.user_id = $1 and s.deleted_at is null
     order by s.name`,
    [userId],
  );
}

/** Inserts a new studio row and returns the created record. */
export async function insertStudio(
  tx: Transaction,
  userId: string,
  input: StudioInput,
): Promise<Studio> {
  return tx.one<Studio>(
    `insert into studios (name, description, city, district, address, genres, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, name, description, city, district, address, genres, created_by, is_hidden, created_at, updated_at`,
    [
      input.name,
      input.description,
      input.city,
      input.district,
      input.address,
      input.genres,
      userId,
    ],
  );
}

/** Inserts a member into studio_members with the given role. */
export async function insertStudioMember(
  tx: Transaction,
  studioId: string,
  userId: string,
  role: 'manager' | 'photographer',
): Promise<void> {
  await tx.execute(
    `insert into studio_members (studio_id, user_id, role)
     values ($1, $2, $3)`,
    [studioId, userId, role],
  );
}

/** Updates mutable details of a non-deleted studio. */
export async function updateStudio(
  tx: Transaction,
  studioId: string,
  input: StudioInput,
): Promise<Studio | undefined> {
  return tx.optional<Studio>(
    `update studios
     set name = $2, description = $3, city = $4, district = $5, address = $6, genres = $7, updated_at = now()
     where id = $1 and deleted_at is null
     returning id, name, description, city, district, address, genres, created_by, is_hidden, created_at, updated_at`,
    [
      studioId,
      input.name,
      input.description,
      input.city,
      input.district,
      input.address,
      input.genres,
    ],
  );
}

/** Lists all team members of a studio joined with their profile and photographer id. */
export async function listStudioTeam(
  tx: Transaction,
  studioId: string,
): Promise<StudioTeamMember[]> {
  return tx.rows<StudioTeamMember>(
    `select m.studio_id, m.user_id, m.role, m.joined_at,
            p.display_name, p.user_name, ph.id as photographer_id
     from studio_members m
     join profiles p on p.id = m.user_id
     join photographers ph on ph.user_id = m.user_id
     where m.studio_id = $1
     order by m.joined_at asc`,
    [studioId],
  );
}

// ---------- 102c: Services ----------

function coerceOwnedService(row: OwnedService): OwnedService {
  return {
    ...row,
    durationMinutes: Number(row.durationMinutes),
    price: Number(row.price),
    photoCount: Number(row.photoCount),
    retouchedCount: Number(row.retouchedCount),
  };
}

/** Finds the caller's photographer id by user_id, or undefined if they are not a photographer. */
export async function findPhotographerIdByUser(
  tx: Transaction,
  userId: string,
): Promise<string | undefined> {
  const row = await tx.optional<{ id: string }>('select id from photographers where user_id = $1', [
    userId,
  ]);
  return row?.id;
}

/** Lists all non-deleted services owned by the caller's photographer profile or managed studios. */
export async function listOwnedServices(tx: Transaction, userId: string): Promise<OwnedService[]> {
  const rows = await tx.rows<OwnedService>(
    `select s.id, s.name, s.description, s.genre, s.duration_minutes, s.price,
            s.photo_count, s.retouched_count, s.is_active, s.owner_type,
            s.photographer_id, s.studio_id, s.created_at, s.updated_at
     from services s
     where s.deleted_at is null
       and (
         (s.photographer_id is not null and exists (
           select 1 from photographers p where p.id = s.photographer_id and p.user_id = $1
         ))
         or
         (s.studio_id is not null and exists (
           select 1 from studio_members m
           join studios st on st.id = m.studio_id
           where m.studio_id = s.studio_id
             and m.user_id = $1
             and m.role = 'manager'
             and st.deleted_at is null
         ))
       )
     order by s.name`,
    [userId],
  );
  return rows.map(coerceOwnedService);
}

/** Inserts a new personal photographer service or studio service. */
export async function insertService(
  tx: Transaction,
  owner:
    | { ownerType: 'photographer'; photographerId: string }
    | { ownerType: 'studio'; studioId: string },
  input: ServiceInput,
): Promise<OwnedService> {
  const photographerId = owner.ownerType === 'photographer' ? owner.photographerId : null;
  const studioId = owner.ownerType === 'studio' ? owner.studioId : null;

  const row = await tx.one<OwnedService>(
    `insert into services (
       owner_type, photographer_id, studio_id, name, description, genre,
       duration_minutes, price, photo_count, retouched_count, is_active
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id, name, description, genre, duration_minutes, price, photo_count,
               retouched_count, is_active, owner_type, photographer_id, studio_id,
               created_at, updated_at`,
    [
      owner.ownerType,
      photographerId,
      studioId,
      input.name,
      input.description,
      input.genre,
      input.durationMinutes,
      input.price,
      input.photoCount,
      input.retouchedCount,
      input.isActive,
    ],
  );
  return coerceOwnedService(row);
}

/** Finds the ownership info of a non-deleted service. */
export async function findServiceOwnership(
  tx: Transaction,
  serviceId: string,
): Promise<{ id: string; photographerId: string | null; studioId: string | null } | undefined> {
  return tx.optional<{ id: string; photographerId: string | null; studioId: string | null }>(
    `select id, photographer_id, studio_id
     from services
     where id = $1 and deleted_at is null`,
    [serviceId],
  );
}

/** Updates an existing non-deleted service. */
export async function updateService(
  tx: Transaction,
  serviceId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  const row = await tx.one<OwnedService>(
    `update services
     set name = $2, description = $3, genre = $4, duration_minutes = $5,
         price = $6, photo_count = $7, retouched_count = $8, is_active = $9,
         updated_at = now()
     where id = $1 and deleted_at is null
     returning id, name, description, genre, duration_minutes, price, photo_count,
               retouched_count, is_active, owner_type, photographer_id, studio_id,
               created_at, updated_at`,
    [
      serviceId,
      input.name,
      input.description,
      input.genre,
      input.durationMinutes,
      input.price,
      input.photoCount,
      input.retouchedCount,
      input.isActive,
    ],
  );
  return coerceOwnedService(row);
}

/** Soft-deletes a service and marks it inactive. */
export async function softDeleteService(tx: Transaction, serviceId: string): Promise<void> {
  await tx.execute(
    'update services set deleted_at = now(), is_active = false, updated_at = now() where id = $1',
    [serviceId],
  );
}

// ---------- 102d: Portfolios & Images ----------

export interface PortfolioImageRow {
  id: string;
  portfolioId: string;
  storagePath: string;
  caption: string;
  sortOrder: number;
  isHidden: boolean;
  createdAt: string;
}

/** Lists all non-deleted portfolios owned by the caller's photographer profile or managed studios. */
export async function listOwnedPortfolios(
  tx: Transaction,
  userId: string,
): Promise<OwnedPortfolio[]> {
  return tx.rows<OwnedPortfolio>(
    `select po.id, po.title, po.description, po.genre, po.status, po.owner_type,
            po.photographer_id, po.studio_id, po.published_at, po.created_at, po.updated_at
     from portfolios po
     where po.deleted_at is null
       and (
         (po.photographer_id is not null and exists (
           select 1 from photographers p where p.id = po.photographer_id and p.user_id = $1
         ))
         or
         (po.studio_id is not null and exists (
           select 1 from studio_members m
           join studios st on st.id = m.studio_id
           where m.studio_id = po.studio_id
             and m.user_id = $1
             and m.role = 'manager'
             and st.deleted_at is null
         ))
       )
     order by po.updated_at desc`,
    [userId],
  );
}

/** Lists published portfolios from visible providers with optional genre and tag slug filters. */
export async function listPublicPortfolios(
  tx: Transaction,
  filters: PortfolioListQuery,
): Promise<PublicPortfolio[]> {
  const conditions: string[] = [
    `po.status = 'published'`,
    `po.deleted_at is null`,
    `exists (select 1 from providers pr where pr.id = coalesce(po.photographer_id, po.studio_id))`,
  ];
  const values: unknown[] = [];

  if (filters.genre) {
    values.push(filters.genre);
    conditions.push(`po.genre = $${values.length}`);
  }
  if (filters.tag) {
    values.push(filters.tag);
    conditions.push(
      `exists (
        select 1 from portfolio_images pi
        join image_tags it on it.portfolio_image_id = pi.id
        join tags t on t.id = it.tag_id
        where pi.portfolio_id = po.id and not pi.is_hidden and t.slug = $${values.length}
      )`,
    );
  }

  const limit = filters.pageSize;
  const offset = (filters.page - 1) * filters.pageSize;
  values.push(limit, offset);

  return tx.rows<PublicPortfolio>(
    `select po.id, po.title, po.description, po.genre, po.status, po.owner_type,
            po.photographer_id, po.studio_id, po.published_at, po.created_at, po.updated_at
     from portfolios po
     where ${conditions.join(' and ')}
     order by po.published_at desc nulls last, po.created_at desc
     limit $${values.length - 1} offset $${values.length}`,
    values,
  );
}

/** Finds a non-deleted portfolio by id regardless of draft/published status. */
export async function findPortfolioById(
  tx: Transaction,
  portfolioId: string,
): Promise<OwnedPortfolio | undefined> {
  return tx.optional<OwnedPortfolio>(
    `select id, title, description, genre, status, owner_type,
            photographer_id, studio_id, published_at, created_at, updated_at
     from portfolios
     where id = $1 and deleted_at is null`,
    [portfolioId],
  );
}

/** Checks whether a portfolio's owning provider is publicly visible (not hidden or deleted). */
export async function isPortfolioProviderVisible(
  tx: Transaction,
  owner: { photographerId: string | null; studioId: string | null },
): Promise<boolean> {
  const providerId = owner.photographerId ?? owner.studioId;
  if (!providerId) return false;
  const row = await tx.optional<{ id: string }>('select id from providers where id = $1', [
    providerId,
  ]);
  return row !== undefined;
}

/** Lists visible images in a portfolio ordered by sort_order. */
export async function listVisiblePortfolioImages(
  tx: Transaction,
  portfolioId: string,
): Promise<PortfolioImageRow[]> {
  const rows = await tx.rows<PortfolioImageRow>(
    `select id, portfolio_id, storage_path, caption, sort_order, is_hidden, created_at
     from portfolio_images
     where portfolio_id = $1 and not is_hidden
     order by sort_order asc, created_at asc`,
    [portfolioId],
  );
  return rows.map((r) => ({ ...r, sortOrder: Number(r.sortOrder) }));
}

/** Lists tags attached to a single portfolio image ordered by kind and name. */
export async function listTagsForImage(tx: Transaction, imageId: string): Promise<Tag[]> {
  return tx.rows<Tag>(
    `select t.id, t.name, t.slug, t.kind
     from tags t
     join image_tags it on it.tag_id = t.id
     where it.portfolio_image_id = $1
     order by t.kind, t.name`,
    [imageId],
  );
}

/** Inserts a new personal photographer portfolio or studio portfolio. */
export async function insertPortfolio(
  tx: Transaction,
  owner:
    | { ownerType: 'photographer'; photographerId: string }
    | { ownerType: 'studio'; studioId: string },
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  const photographerId = owner.ownerType === 'photographer' ? owner.photographerId : null;
  const studioId = owner.ownerType === 'studio' ? owner.studioId : null;
  const publishedAt = input.status === 'published' ? new Date().toISOString() : null;

  return tx.one<OwnedPortfolio>(
    `insert into portfolios (
       owner_type, photographer_id, studio_id, title, description, genre, status, published_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, title, description, genre, status, owner_type, photographer_id, studio_id,
               published_at, created_at, updated_at`,
    [
      owner.ownerType,
      photographerId,
      studioId,
      input.title,
      input.description,
      input.genre,
      input.status,
      publishedAt,
    ],
  );
}

/** Updates an existing non-deleted portfolio, setting published_at on first publish. */
export async function updatePortfolio(
  tx: Transaction,
  portfolioId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  return tx.one<OwnedPortfolio>(
    `update portfolios
     set title = $2,
         description = $3,
         genre = $4,
         status = $5,
         published_at = case
           when $5 = 'published' then coalesce(published_at, now())
           else published_at
         end,
         updated_at = now()
     where id = $1 and deleted_at is null
     returning id, title, description, genre, status, owner_type, photographer_id, studio_id,
               published_at, created_at, updated_at`,
    [portfolioId, input.title, input.description, input.genre, input.status],
  );
}

/** Soft-deletes a portfolio. */
export async function softDeletePortfolio(tx: Transaction, portfolioId: string): Promise<void> {
  await tx.execute('update portfolios set deleted_at = now(), updated_at = now() where id = $1', [
    portfolioId,
  ]);
}

/** Inserts an image row into a portfolio. */
export async function insertPortfolioImage(
  tx: Transaction,
  portfolioId: string,
  input: PortfolioImageInput,
): Promise<PortfolioImageRow> {
  const row = await tx.one<PortfolioImageRow>(
    `insert into portfolio_images (portfolio_id, storage_path, caption, sort_order)
     values ($1, $2, $3, $4)
     returning id, portfolio_id, storage_path, caption, sort_order, is_hidden, created_at`,
    [portfolioId, input.storagePath, input.caption, input.sortOrder],
  );
  return { ...row, sortOrder: Number(row.sortOrder) };
}

/** Finds the owning portfolio of a non-deleted portfolio image. */
export async function findImagePortfolioOwnership(
  tx: Transaction,
  imageId: string,
): Promise<
  | { imageId: string; portfolioId: string; photographerId: string | null; studioId: string | null }
  | undefined
> {
  return tx.optional<{
    imageId: string;
    portfolioId: string;
    photographerId: string | null;
    studioId: string | null;
  }>(
    `select pi.id as image_id, po.id as portfolio_id, po.photographer_id, po.studio_id
     from portfolio_images pi
     join portfolios po on po.id = pi.portfolio_id
     where pi.id = $1 and po.deleted_at is null`,
    [imageId],
  );
}

/** Replaces all tag assignments on a portfolio image and returns the resulting tags. */
export async function replacePortfolioImageTags(
  tx: Transaction,
  imageId: string,
  tagIds: string[],
): Promise<Tag[]> {
  await tx.execute('delete from image_tags where portfolio_image_id = $1', [imageId]);
  const uniqueIds = [...new Set(tagIds)];
  for (const tagId of uniqueIds) {
    await tx.execute(
      'insert into image_tags (portfolio_image_id, tag_id) values ($1, $2) on conflict do nothing',
      [imageId, tagId],
    );
  }
  return listTagsForImage(tx, imageId);
}

// ---------- 102e: Invitations, Members, Resources & Add-ons ----------

function coerceServiceAddOn(row: ServiceAddOn): ServiceAddOn {
  return {
    ...row,
    price: Number(row.price),
  };
}

/** Lists pending invitations addressed to the caller's photographer profile. */
export async function listPendingInvitationsForUser(
  tx: Transaction,
  userId: string,
): Promise<MyInvitation[]> {
  return tx.rows<MyInvitation>(
    `select si.id, si.studio_id, si.photographer_id, si.role, si.status, si.invited_by,
            si.responded_at, si.created_at, si.updated_at,
            st.name as studio_name,
            coalesce(pr.display_name, '') as inviter_name
     from studio_invitations si
     join photographers p on p.id = si.photographer_id
     join studios st on st.id = si.studio_id
     left join profiles pr on pr.id = si.invited_by
     where p.user_id = $1
       and si.status = 'pending'
       and st.deleted_at is null
     order by si.created_at desc`,
    [userId],
  );
}

/** Finds the user_id for a photographer id, or undefined if the photographer does not exist. */
export async function findPhotographerUserId(
  tx: Transaction,
  photographerId: string,
): Promise<string | undefined> {
  const row = await tx.optional<{ userId: string }>(
    'select user_id from photographers where id = $1',
    [photographerId],
  );
  return row?.userId;
}

/** Checks whether a user is already a member of a studio. */
export async function isStudioMember(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<boolean> {
  const row = await tx.optional<{ userId: string }>(
    'select user_id from studio_members where studio_id = $1 and user_id = $2',
    [studioId, userId],
  );
  return row !== undefined;
}

/** Checks whether a pending invitation already exists for the studio and photographer. */
export async function hasPendingStudioInvitation(
  tx: Transaction,
  studioId: string,
  photographerId: string,
): Promise<boolean> {
  const row = await tx.optional<{ id: string }>(
    `select id from studio_invitations
     where studio_id = $1 and photographer_id = $2 and status = 'pending'`,
    [studioId, photographerId],
  );
  return row !== undefined;
}

/** Creates a pending studio invitation. */
export async function insertStudioInvitation(
  tx: Transaction,
  studioId: string,
  invitedBy: string,
  input: StudioInvitationInput,
): Promise<StudioInvitation> {
  return tx.one<StudioInvitation>(
    `insert into studio_invitations (studio_id, photographer_id, role, status, invited_by)
     values ($1, $2, $3, 'pending', $4)
     returning id, studio_id, photographer_id, role, status, invited_by,
               responded_at, created_at, updated_at`,
    [studioId, input.photographerId, input.role, invitedBy],
  );
}

/** Finds an invitation along with the invited photographer's user_id. */
export async function findInvitationWithRecipient(
  tx: Transaction,
  invitationId: string,
): Promise<(StudioInvitation & { recipientUserId: string }) | undefined> {
  return tx.optional<StudioInvitation & { recipientUserId: string }>(
    `select si.id, si.studio_id, si.photographer_id, si.role, si.status, si.invited_by,
            si.responded_at, si.created_at, si.updated_at,
            p.user_id as recipient_user_id
     from studio_invitations si
     join photographers p on p.id = si.photographer_id
     where si.id = $1`,
    [invitationId],
  );
}

/** Marks an invitation as accepted or declined and returns the updated row. */
export async function updateInvitationStatus(
  tx: Transaction,
  invitationId: string,
  status: 'accepted' | 'declined',
): Promise<StudioInvitation> {
  return tx.one<StudioInvitation>(
    `update studio_invitations
     set status = $2, responded_at = now(), updated_at = now()
     where id = $1
     returning id, studio_id, photographer_id, role, status, invited_by,
               responded_at, created_at, updated_at`,
    [invitationId, status],
  );
}

/** Counts how many current managers a studio has. */
export async function countStudioManagers(tx: Transaction, studioId: string): Promise<number> {
  const row = await tx.one<{ count: string }>(
    `select count(*)::text as count
     from studio_members
     where studio_id = $1 and role = 'manager'`,
    [studioId],
  );
  return Number(row.count);
}

/** Finds a member's current role in a studio, or undefined if not a member. */
export async function findStudioMemberRole(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<'manager' | 'photographer' | undefined> {
  const row = await tx.optional<{ role: 'manager' | 'photographer' }>(
    'select role from studio_members where studio_id = $1 and user_id = $2',
    [studioId, userId],
  );
  return row?.role;
}

/** Updates a studio member's role and returns their updated team member record. */
export async function updateStudioMemberRole(
  tx: Transaction,
  studioId: string,
  userId: string,
  role: 'manager' | 'photographer',
): Promise<StudioTeamMember> {
  await tx.execute('update studio_members set role = $3 where studio_id = $1 and user_id = $2', [
    studioId,
    userId,
    role,
  ]);
  return tx.one<StudioTeamMember>(
    `select m.studio_id, m.user_id, m.role, m.joined_at,
            coalesce(pr.display_name, '') as display_name,
            coalesce(pr.user_name, '') as user_name,
            p.id as photographer_id
     from studio_members m
     left join profiles pr on pr.id = m.user_id
     left join photographers p on p.user_id = m.user_id
     where m.studio_id = $1 and m.user_id = $2`,
    [studioId, userId],
  );
}

/** Checks whether a user has active studio bookings assigned to their photographer profile. */
export async function hasActiveStudioBookingAssignments(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<boolean> {
  const row = await tx.optional<{ id: string }>(
    `select b.id
     from bookings b
     join photographers p on p.id = b.assigned_photographer_id
     where b.studio_id = $1
       and p.user_id = $2
       and b.status not in ('completed', 'cancelled', 'declined')
     limit 1`,
    [studioId, userId],
  );
  return row !== undefined;
}

/** Removes a member from a studio. */
export async function deleteStudioMember(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<void> {
  await tx.execute('delete from studio_members where studio_id = $1 and user_id = $2', [
    studioId,
    userId,
  ]);
}

/** Lists non-deleted resources belonging to a studio. */
export async function listStudioResources(
  tx: Transaction,
  studioId: string,
): Promise<StudioResource[]> {
  return tx.rows<StudioResource>(
    `select id, studio_id, name, type, description, is_active, created_at, updated_at
     from studio_resources
     where studio_id = $1 and deleted_at is null
     order by name`,
    [studioId],
  );
}

/** Inserts a new studio resource. */
export async function insertStudioResource(
  tx: Transaction,
  studioId: string,
  input: StudioResourceInput,
): Promise<StudioResource> {
  return tx.one<StudioResource>(
    `insert into studio_resources (studio_id, name, type, description, is_active)
     values ($1, $2, $3, $4, $5)
     returning id, studio_id, name, type, description, is_active, created_at, updated_at`,
    [studioId, input.name, input.type, input.description, input.isActive],
  );
}

/** Finds the owning studio_id of a non-deleted resource. */
export async function findResourceStudioId(
  tx: Transaction,
  resourceId: string,
): Promise<string | undefined> {
  const row = await tx.optional<{ studioId: string }>(
    'select studio_id from studio_resources where id = $1 and deleted_at is null',
    [resourceId],
  );
  return row?.studioId;
}

/** Updates an existing non-deleted studio resource. */
export async function updateStudioResource(
  tx: Transaction,
  resourceId: string,
  input: StudioResourceInput,
): Promise<StudioResource> {
  return tx.one<StudioResource>(
    `update studio_resources
     set name = $2, type = $3, description = $4, is_active = $5, updated_at = now()
     where id = $1 and deleted_at is null
     returning id, studio_id, name, type, description, is_active, created_at, updated_at`,
    [resourceId, input.name, input.type, input.description, input.isActive],
  );
}

/** Soft-deletes a studio resource and marks it inactive. */
export async function softDeleteStudioResource(tx: Transaction, resourceId: string): Promise<void> {
  await tx.execute(
    'update studio_resources set deleted_at = now(), is_active = false, updated_at = now() where id = $1',
    [resourceId],
  );
}

/** Lists non-deleted add-ons for a service. */
export async function listServiceAddOns(
  tx: Transaction,
  serviceId: string,
): Promise<ServiceAddOn[]> {
  const rows = await tx.rows<ServiceAddOn>(
    `select id, service_id, name, description, price, is_active, created_at, updated_at
     from service_add_ons
     where service_id = $1 and deleted_at is null
     order by name`,
    [serviceId],
  );
  return rows.map(coerceServiceAddOn);
}

/** Inserts a new add-on for a service. */
export async function insertServiceAddOn(
  tx: Transaction,
  serviceId: string,
  input: ServiceAddOnInput,
): Promise<ServiceAddOn> {
  const row = await tx.one<ServiceAddOn>(
    `insert into service_add_ons (service_id, name, description, price, is_active)
     values ($1, $2, $3, $4, $5)
     returning id, service_id, name, description, price, is_active, created_at, updated_at`,
    [serviceId, input.name, input.description, input.price, input.isActive],
  );
  return coerceServiceAddOn(row);
}
