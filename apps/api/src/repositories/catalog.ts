import type { Transaction } from './database.js';
import type {
  ExploreProvider,
  ExploreQuery,
  MyInvitation,
  MyStudio,
  OwnedPortfolio,
  OwnedService,
  PortfolioImage,
  PortfolioImageInput,
  PortfolioInput,
  PortfolioListQuery,
  Provider,
  ProviderListQuery,
  PublicPortfolio,
  PublicReview,
  Service,
  ServiceAddOn,
  ServiceAddOnInput,
  ServiceInput,
  Studio,
  StudioInput,
  StudioInvitation,
  StudioInvitationInput,
  StudioResource,
  StudioResourceInput,
  StudioTeamMember,
  Tag,
} from '../schemas/catalog.js';

export type PortfolioImageRow = Omit<PortfolioImage, 'url' | 'tags'>;

/** Coerces Postgres numeric/bigint string columns into JS numbers to satisfy providerSchema. */
function coerceProvider(row: Provider): Provider {
  return {
    ...row,
    genres: row.genres ?? [],
    styles: row.styles ?? [],
    priceFrom: row.priceFrom === null ? null : Number(row.priceFrom),
    ratingAvg: row.ratingAvg === null ? null : Number(row.ratingAvg),
    reviewCount: Number(row.reviewCount ?? 0),
  };
}

/** Coerces a provider row with an optional cover image path for explore cards. */
function coerceExploreProvider(row: ExploreProvider): ExploreProvider {
  return {
    ...coerceProvider(row),
    coverUrl: row.coverUrl ?? null,
  };
}

/** Coerces Postgres integer/numeric columns into JS numbers for serviceSchema. */
function coerceService(row: Service): Service {
  return {
    ...row,
    durationMinutes: Number(row.durationMinutes),
    price: Number(row.price),
    photoCount: Number(row.photoCount),
    retouchedCount: Number(row.retouchedCount),
  };
}

/** Coerces Postgres integer/numeric columns into JS numbers for ownedServiceSchema. */
function coerceOwnedService(row: OwnedService): OwnedService {
  return {
    ...coerceService(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Coerces Postgres numeric/integer price column into a JS number for serviceAddOnSchema. */
function coerceServiceAddOn(row: ServiceAddOn): ServiceAddOn {
  return {
    ...row,
    price: Number(row.price),
  };
}

/**
 * Defense-in-depth visibility guard on top of the public.providers view:
 * guarantees hidden photographers and hidden or soft-deleted studios are never exposed.
 */
const VISIBLE_PROVIDER_SQL = `(
  (p.type = 'photographer' and exists (
    select 1 from photographers ph where ph.id = p.id and ph.is_hidden = false
  ))
  or
  (p.type = 'studio' and exists (
    select 1 from studios st where st.id = p.id and st.is_hidden = false and st.deleted_at is null
  ))
)`;

/** Queries visible public providers for GET /v1/explore with filters, pagination, and cover image. */
export async function discoverProviders(
  tx: Transaction,
  query: ExploreQuery,
): Promise<ExploreProvider[]> {
  const conditions: string[] = [VISIBLE_PROVIDER_SQL];
  const params: unknown[] = [];

  if (query.genre) {
    params.push(query.genre);
    conditions.push(`$${params.length}::genre = any(p.genres)`);
  }
  if (query.city) {
    params.push(query.city);
    conditions.push(`lower(p.city) = lower($${params.length})`);
  }
  if (query.district) {
    params.push(query.district);
    conditions.push(`lower(p.district) = lower($${params.length})`);
  }
  if (query.priceMax !== undefined) {
    params.push(query.priceMax);
    conditions.push(`p.price_from is not null and p.price_from <= $${params.length}`);
  }

  const limitParam = params.push(query.pageSize);
  const offsetParam = params.push((query.page - 1) * query.pageSize);
  const where = `where ${conditions.join(' and ')}`;

  const rows = await tx.rows<ExploreProvider>(
    `select p.id, p.type, p.display_name, p.bio, p.city, p.district,
            p.genres, p.styles, p.price_from, p.rating_avg, p.review_count,
            cover.storage_path as cover_url
     from providers p
     left join lateral (
       select pi.storage_path
       from portfolios pf
       join portfolio_images pi on pi.portfolio_id = pf.id and pi.is_hidden = false
       where pf.status = 'published'
         and pf.deleted_at is null
         and ((p.type = 'photographer' and pf.photographer_id = p.id)
           or (p.type = 'studio' and pf.studio_id = p.id))
       order by pf.published_at desc nulls last, pi.sort_order, pi.created_at
       limit 1
     ) cover on true
     ${where}
     order by p.rating_avg desc nulls last, p.review_count desc, p.display_name
     limit $${limitParam} offset $${offsetParam}`,
    params,
  );

  return rows.map(coerceExploreProvider);
}

/** Lists visible public providers by type with optional filters and pagination. */
export async function listProvidersByType(
  tx: Transaction,
  type: 'photographer' | 'studio',
  query: ProviderListQuery,
): Promise<Provider[]> {
  const conditions: string[] = ['p.type = $1', VISIBLE_PROVIDER_SQL];
  const params: unknown[] = [type];

  if (query.genre) {
    params.push(query.genre);
    conditions.push(`$${params.length}::genre = any(p.genres)`);
  }
  if (query.city) {
    params.push(query.city);
    conditions.push(`lower(p.city) = lower($${params.length})`);
  }
  if (query.district) {
    params.push(query.district);
    conditions.push(`lower(p.district) = lower($${params.length})`);
  }

  const limitParam = params.push(query.pageSize);
  const offsetParam = params.push((query.page - 1) * query.pageSize);

  const rows = await tx.rows<Provider>(
    `select p.id, p.type, p.display_name, p.bio, p.city, p.district,
            p.genres, p.styles, p.price_from, p.rating_avg, p.review_count
     from providers p
     where ${conditions.join(' and ')}
     order by p.rating_avg desc nulls last, p.review_count desc, p.display_name
     limit $${limitParam} offset $${offsetParam}`,
    params,
  );
  return rows.map(coerceProvider);
}

/** Finds a single visible provider by id and type. */
export async function findProviderById(
  tx: Transaction,
  type: 'photographer' | 'studio',
  id: string,
): Promise<Provider | undefined> {
  const row = await tx.optional<Provider>(
    `select p.id, p.type, p.display_name, p.bio, p.city, p.district,
            p.genres, p.styles, p.price_from, p.rating_avg, p.review_count
     from providers p
     where p.type = $1 and p.id = $2 and ${VISIBLE_PROVIDER_SQL}`,
    [type, id],
  );
  return row ? coerceProvider(row) : undefined;
}

/** Lists active, non-deleted services offered by a provider. */
export async function listActiveServicesByProvider(
  tx: Transaction,
  type: 'photographer' | 'studio',
  providerId: string,
): Promise<Service[]> {
  const column = type === 'photographer' ? 'photographer_id' : 'studio_id';
  const rows = await tx.rows<Service>(
    `select id, name, description, genre, duration_minutes, price,
            photo_count, retouched_count, is_active,
            owner_type, photographer_id, studio_id
     from services
     where ${column} = $1 and is_active = true and deleted_at is null
     order by price, name`,
    [providerId],
  );
  return rows.map(coerceService);
}

/** Lists published, non-deleted portfolios owned by a provider with their cover image path. */
export async function listPublishedPortfoliosByProvider(
  tx: Transaction,
  type: 'photographer' | 'studio',
  providerId: string,
): Promise<PublicPortfolio[]> {
  const column = type === 'photographer' ? 'photographer_id' : 'studio_id';
  return tx.rows<PublicPortfolio>(
    `select pf.id, pf.title, pf.description, pf.genre, pf.status,
            pf.owner_type, pf.photographer_id, pf.studio_id,
            pf.published_at, pf.created_at, pf.updated_at,
            cover.storage_path as cover_url
     from portfolios pf
     left join lateral (
       select storage_path from portfolio_images
       where portfolio_id = pf.id and is_hidden = false
       order by sort_order, created_at limit 1
     ) cover on true
     where pf.${column} = $1 and pf.status = 'published' and pf.deleted_at is null
     order by pf.published_at desc nulls last, pf.created_at desc`,
    [providerId],
  );
}

/** Lists up to 20 visible reviews for a provider, joined with author display names. */
export async function listVisibleReviewsByProvider(
  tx: Transaction,
  type: 'photographer' | 'studio',
  providerId: string,
): Promise<PublicReview[]> {
  const column = type === 'photographer' ? 'photographer_id' : 'studio_id';
  const rows = await tx.rows<PublicReview>(
    `select r.id, r.booking_id, r.author_id,
            coalesce(pr.display_name, '') as author_name,
            r.photographer_id, r.studio_id, r.rating, r.comment,
            r.created_at, r.updated_at
     from reviews r
     left join profiles pr on pr.id = r.author_id
     where r.${column} = $1 and r.is_hidden = false and r.deleted_at is null
     order by r.created_at desc
     limit 20`,
    [providerId],
  );
  return rows.map((r) => ({ ...r, rating: Number(r.rating) }));
}

/** Lists all taxonomy tags ordered by kind and name. */
export async function listTags(tx: Transaction): Promise<Tag[]> {
  return tx.rows<Tag>('select id, name, slug, kind from tags order by kind, name');
}

// ---------- 102b: Studios & Team ----------

/** Checks whether the caller is an active manager of a non-deleted studio. */
export async function isStudioManager(
  tx: Transaction,
  studioId: string,
  userId: string,
): Promise<boolean> {
  const row = await tx.optional<{ studioId: string }>(
    `select m.studio_id
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
export async function listStudiosForUser(tx: Transaction, userId: string): Promise<MyStudio[]> {
  return tx.rows<MyStudio>(
    `select s.id, s.name, s.description, s.city, s.district, s.address,
            s.genres, s.created_by, s.is_hidden, s.created_at, s.updated_at,
            m.role
     from studios s
     join studio_members m on m.studio_id = s.id
     where m.user_id = $1 and s.deleted_at is null
     order by s.created_at desc`,
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
     values ($1, $2, $3, $4, $5, $6::genre[], $7)
     returning id, name, description, city, district, address,
               genres, created_by, is_hidden, created_at, updated_at`,
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

/** Inserts a member into studio_members with the given role (idempotent on conflict). */
export async function insertStudioMember(
  tx: Transaction,
  studioId: string,
  userId: string,
  role: 'manager' | 'photographer',
): Promise<void> {
  await tx.execute(
    `insert into studio_members (studio_id, user_id, role)
     values ($1, $2, $3::studio_member_role)
     on conflict (studio_id, user_id) do nothing`,
    [studioId, userId, role],
  );
}

/** Updates mutable details of a non-deleted studio. */
export async function updateStudio(
  tx: Transaction,
  studioId: string,
  input: StudioInput,
): Promise<Studio> {
  return tx.one<Studio>(
    `update studios
     set name = $2, description = $3, city = $4, district = $5,
         address = $6, genres = $7::genre[], updated_at = now()
     where id = $1 and deleted_at is null
     returning id, name, description, city, district, address,
               genres, created_by, is_hidden, created_at, updated_at`,
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
            coalesce(pr.display_name, '') as display_name,
            coalesce(pr.user_name, '') as user_name,
            p.id as photographer_id
     from studio_members m
     left join profiles pr on pr.id = m.user_id
     left join photographers p on p.user_id = m.user_id
     where m.studio_id = $1
     order by m.joined_at asc`,
    [studioId],
  );
}

// ---------- 102c: Services ----------

export type ServiceOwnershipRow = {
  id: string;
  photographerId: string | null;
  studioId: string | null;
};

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
            s.photo_count, s.retouched_count, s.is_active,
            s.owner_type, s.photographer_id, s.studio_id,
            s.created_at, s.updated_at
     from services s
     where s.deleted_at is null
       and (
         s.photographer_id in (select id from photographers where user_id = $1)
         or s.studio_id in (
           select m.studio_id
           from studio_members m
           join studios st on st.id = m.studio_id
           where m.user_id = $1 and m.role = 'manager' and st.deleted_at is null
         )
       )
     order by s.created_at desc`,
    [userId],
  );
  return rows.map(coerceOwnedService);
}

/** Inserts a new personal photographer service. */
export async function insertPersonalService(
  tx: Transaction,
  photographerId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  const row = await tx.one<OwnedService>(
    `insert into services (
       owner_type, photographer_id, studio_id, name, description, genre,
       duration_minutes, price, photo_count, retouched_count, is_active
     )
     values ('photographer', $1, null, $2, $3, $4::genre, $5, $6, $7, $8, $9)
     returning id, name, description, genre, duration_minutes, price,
               photo_count, retouched_count, is_active,
               owner_type, photographer_id, studio_id,
               created_at, updated_at`,
    [
      photographerId,
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

/** Inserts a new studio-owned service. */
export async function insertStudioService(
  tx: Transaction,
  studioId: string,
  input: ServiceInput,
): Promise<OwnedService> {
  const row = await tx.one<OwnedService>(
    `insert into services (
       owner_type, photographer_id, studio_id, name, description, genre,
       duration_minutes, price, photo_count, retouched_count, is_active
     )
     values ('studio', null, $1, $2, $3, $4::genre, $5, $6, $7, $8, $9)
     returning id, name, description, genre, duration_minutes, price,
               photo_count, retouched_count, is_active,
               owner_type, photographer_id, studio_id,
               created_at, updated_at`,
    [
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
): Promise<ServiceOwnershipRow | undefined> {
  return tx.optional<ServiceOwnershipRow>(
    'select id, photographer_id, studio_id from services where id = $1 and deleted_at is null',
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
     set name = $2, description = $3, genre = $4::genre, duration_minutes = $5,
         price = $6, photo_count = $7, retouched_count = $8, is_active = $9,
         updated_at = now()
     where id = $1 and deleted_at is null
     returning id, name, description, genre, duration_minutes, price,
               photo_count, retouched_count, is_active,
               owner_type, photographer_id, studio_id,
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

export type PortfolioOwnershipRow = {
  id: string;
  photographerId: string | null;
  studioId: string | null;
  status: 'draft' | 'published' | 'hidden';
  publishedAt: string | null;
};

/** Lists all non-deleted portfolios owned by the caller's photographer profile or managed studios. */
export async function listOwnedPortfolios(
  tx: Transaction,
  userId: string,
): Promise<OwnedPortfolio[]> {
  return tx.rows<OwnedPortfolio>(
    `select pf.id, pf.title, pf.description, pf.genre, pf.status,
            pf.owner_type, pf.photographer_id, pf.studio_id,
            pf.published_at, pf.created_at, pf.updated_at
     from portfolios pf
     where pf.deleted_at is null
       and (
         pf.photographer_id in (select id from photographers where user_id = $1)
         or pf.studio_id in (
           select m.studio_id
           from studio_members m
           join studios st on st.id = m.studio_id
           where m.user_id = $1 and m.role = 'manager' and st.deleted_at is null
         )
       )
     order by pf.created_at desc`,
    [userId],
  );
}

/** Lists published portfolios from visible providers with optional genre and tag slug filters. */
export async function listPublicPortfolios(
  tx: Transaction,
  query: PortfolioListQuery,
): Promise<PublicPortfolio[]> {
  const conditions: string[] = [
    "pf.status = 'published'",
    'pf.deleted_at is null',
    `((pf.photographer_id is not null and exists (
        select 1 from photographers ph where ph.id = pf.photographer_id and ph.is_hidden = false
      ))
      or (pf.studio_id is not null and exists (
        select 1 from studios st where st.id = pf.studio_id and st.is_hidden = false and st.deleted_at is null
      )))`,
  ];
  const params: unknown[] = [];

  if (query.genre) {
    params.push(query.genre);
    conditions.push(`pf.genre = $${params.length}::genre`);
  }
  if (query.tag) {
    params.push(query.tag);
    conditions.push(
      `exists (
        select 1
        from portfolio_images pi
        join image_tags pit on pit.portfolio_image_id = pi.id
        join tags t on t.id = pit.tag_id
        where pi.portfolio_id = pf.id
          and pi.is_hidden = false
          and lower(t.slug) = lower($${params.length})
      )`,
    );
  }

  const limitParam = params.push(query.pageSize);
  const offsetParam = params.push((query.page - 1) * query.pageSize);

  return tx.rows<PublicPortfolio>(
    `select pf.id, pf.title, pf.description, pf.genre, pf.status,
            pf.owner_type, pf.photographer_id, pf.studio_id,
            pf.published_at, pf.created_at, pf.updated_at,
            cover.storage_path as cover_url
     from portfolios pf
     left join lateral (
       select storage_path from portfolio_images
       where portfolio_id = pf.id and is_hidden = false
       order by sort_order, created_at limit 1
     ) cover on true
     where ${conditions.join(' and ')}
     order by pf.published_at desc nulls last, pf.created_at desc
     limit $${limitParam} offset $${offsetParam}`,
    params,
  );
}

/** Finds a non-deleted portfolio by id regardless of status. */
export async function findPortfolioById(
  tx: Transaction,
  portfolioId: string,
): Promise<OwnedPortfolio | undefined> {
  return tx.optional<OwnedPortfolio>(
    `select id, title, description, genre, status,
            owner_type, photographer_id, studio_id,
            published_at, created_at, updated_at
     from portfolios
     where id = $1 and deleted_at is null`,
    [portfolioId],
  );
}

/** Checks whether a portfolio's owning provider is publicly visible (not hidden or deleted). */
export async function isPortfolioProviderVisible(
  tx: Transaction,
  portfolio: Pick<OwnedPortfolio, 'photographerId' | 'studioId'>,
): Promise<boolean> {
  if (portfolio.photographerId) {
    const row = await tx.optional<{ id: string }>(
      'select id from photographers where id = $1 and is_hidden = false',
      [portfolio.photographerId],
    );
    return row !== undefined;
  }
  if (portfolio.studioId) {
    const row = await tx.optional<{ id: string }>(
      'select id from studios where id = $1 and is_hidden = false and deleted_at is null',
      [portfolio.studioId],
    );
    return row !== undefined;
  }
  return false;
}

/** Lists visible images in a portfolio ordered by sort_order. */
export async function listPortfolioImages(
  tx: Transaction,
  portfolioId: string,
): Promise<PortfolioImageRow[]> {
  const rows = await tx.rows<PortfolioImageRow>(
    `select id, portfolio_id, storage_path, width, height, caption, sort_order,
            provenance, source, license_note, is_hidden, created_at
     from portfolio_images
     where portfolio_id = $1 and is_hidden = false
     order by sort_order asc, created_at asc`,
    [portfolioId],
  );
  return rows.map((row) => ({
    ...row,
    width: Number(row.width),
    height: Number(row.height),
    sortOrder: Number(row.sortOrder),
  }));
}

/** Fetches tags for a batch of portfolio image IDs in a single query to avoid N+1. */
export async function listTagsForImages(tx: Transaction, imageIds: string[]) {
  const grouped = new Map<string, Tag[]>();
  if (imageIds.length === 0) return grouped;

  const rows = await tx.rows<Tag & { portfolioImageId: string }>(
    `select pit.portfolio_image_id, t.id, t.name, t.slug, t.kind
     from image_tags pit
     join tags t on t.id = pit.tag_id
     where pit.portfolio_image_id = any($1::uuid[])
     order by t.kind, t.name`,
    [imageIds],
  );

  for (const row of rows) {
    const { portfolioImageId, ...tag } = row;
    const list = grouped.get(portfolioImageId) ?? [];
    list.push(tag);
    grouped.set(portfolioImageId, list);
  }
  return grouped;
}

/** Lists tags attached to a single portfolio image ordered by kind and name. */
export async function listTagsForImage(tx: Transaction, imageId: string): Promise<Tag[]> {
  const map = await listTagsForImages(tx, [imageId]);
  return map.get(imageId) ?? [];
}

/** Inserts a new personal photographer portfolio, setting published_at when published immediately. */
export async function insertPersonalPortfolio(
  tx: Transaction,
  photographerId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  return tx.one<OwnedPortfolio>(
    `insert into portfolios (
       owner_type, photographer_id, studio_id, title, description, genre, status, published_at
     )
     values (
       'photographer', $1, null, $2, $3, $4::genre, $5::portfolio_status,
       case when $5::portfolio_status = 'published' then now() else null end
     )
     returning id, title, description, genre, status,
               owner_type, photographer_id, studio_id,
               published_at, created_at, updated_at`,
    [photographerId, input.title, input.description, input.genre, input.status],
  );
}

/** Inserts a new studio-owned portfolio, setting published_at when published immediately. */
export async function insertStudioPortfolio(
  tx: Transaction,
  studioId: string,
  input: PortfolioInput,
): Promise<OwnedPortfolio> {
  return tx.one<OwnedPortfolio>(
    `insert into portfolios (
       owner_type, photographer_id, studio_id, title, description, genre, status, published_at
     )
     values (
       'studio', null, $1, $2, $3, $4::genre, $5::portfolio_status,
       case when $5::portfolio_status = 'published' then now() else null end
     )
     returning id, title, description, genre, status,
               owner_type, photographer_id, studio_id,
               published_at, created_at, updated_at`,
    [studioId, input.title, input.description, input.genre, input.status],
  );
}

/** Finds the ownership and status info of a non-deleted portfolio. */
export async function findPortfolioOwnership(
  tx: Transaction,
  portfolioId: string,
): Promise<PortfolioOwnershipRow | undefined> {
  return tx.optional<PortfolioOwnershipRow>(
    `select id, photographer_id, studio_id, status, published_at
     from portfolios
     where id = $1 and deleted_at is null`,
    [portfolioId],
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
         genre = $4::genre,
         status = $5::portfolio_status,
         published_at = case
           when $5::portfolio_status = 'published' and published_at is null then now()
           else published_at
         end,
         updated_at = now()
     where id = $1 and deleted_at is null
     returning id, title, description, genre, status,
               owner_type, photographer_id, studio_id,
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

/** Inserts an image row with dimensions and provenance metadata into a portfolio. */
export async function insertPortfolioImage(
  tx: Transaction,
  portfolioId: string,
  input: PortfolioImageInput,
): Promise<PortfolioImageRow> {
  const row = await tx.one<PortfolioImageRow>(
    `insert into portfolio_images (
       portfolio_id, storage_path, width, height, caption, sort_order,
       provenance, source, license_note
     )
     values ($1, $2, $3, $4, $5, $6, $7::provenance, $8, $9)
     returning id, portfolio_id, storage_path, width, height, caption, sort_order,
               provenance, source, license_note, is_hidden, created_at`,
    [
      portfolioId,
      input.storagePath,
      input.width,
      input.height,
      input.caption,
      input.sortOrder,
      input.provenance,
      input.source ?? null,
      input.licenseNote ?? null,
    ],
  );
  return {
    ...row,
    width: Number(row.width),
    height: Number(row.height),
    sortOrder: Number(row.sortOrder),
  };
}

/** Finds the owning portfolio of a non-deleted portfolio image. */
export async function findPortfolioImageOwnership(
  tx: Transaction,
  imageId: string,
): Promise<(PortfolioOwnershipRow & { imageId: string }) | undefined> {
  return tx.optional<PortfolioOwnershipRow & { imageId: string }>(
    `select pi.id as image_id, pf.id, pf.photographer_id, pf.studio_id, pf.status, pf.published_at
     from portfolio_images pi
     join portfolios pf on pf.id = pi.portfolio_id
     where pi.id = $1 and pf.deleted_at is null`,
    [imageId],
  );
}

/** Counts how many of the given tag IDs exist in the tags table. */
export async function countExistingTags(tx: Transaction, tagIds: string[]): Promise<number> {
  if (tagIds.length === 0) return 0;
  const row = await tx.one<{ count: string }>(
    'select count(*)::text as count from tags where id = any($1::uuid[])',
    [tagIds],
  );
  return Number(row.count);
}

/** Replaces all tag assignments on a portfolio image in bulk. */
export async function replacePortfolioImageTags(
  tx: Transaction,
  imageId: string,
  tagIds: string[],
): Promise<void> {
  await tx.execute('delete from image_tags where portfolio_image_id = $1', [imageId]);
  if (tagIds.length === 0) return;

  await tx.execute(
    `insert into image_tags (portfolio_image_id, tag_id, source)
     select $1, unnest($2::uuid[]), 'manual'
     on conflict (portfolio_image_id, tag_id) do nothing`,
    [imageId, tagIds],
  );
}

// ---------- 102e: Invitations, Members, Resources & Add-ons ----------

/** Acquires a transaction-scoped advisory lock per studio to serialize membership mutations. */
export async function lockStudioMembers(tx: Transaction, studioId: string): Promise<void> {
  await tx.execute("select pg_advisory_xact_lock(hashtext('studio_members:' || $1))", [studioId]);
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
     values ($1, $2, $3::studio_member_role, 'pending', $4)
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

/** Atomically transitions a pending invitation; returns undefined if already responded/revoked. */
export async function respondPendingInvitation(
  tx: Transaction,
  invitationId: string,
  status: 'accepted' | 'declined' | 'revoked',
): Promise<StudioInvitation | undefined> {
  return tx.optional<StudioInvitation>(
    `update studio_invitations
     set status = $2::invitation_status, responded_at = now(), updated_at = now()
     where id = $1 and status = 'pending'
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
  await tx.execute(
    'update studio_members set role = $3::studio_member_role where studio_id = $1 and user_id = $2',
    [studioId, userId, role],
  );
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
       and b.status not in ('completed', 'cancelled', 'rejected')
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
     values ($1, $2, $3::resource_type, $4, $5)
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
     set name = $2, type = $3::resource_type, description = $4, is_active = $5, updated_at = now()
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

/** Lists active add-ons for an active service belonging to a visible provider, or undefined if hidden/missing. */
export async function listActivePublicServiceAddOns(
  tx: Transaction,
  serviceId: string,
): Promise<ServiceAddOn[] | undefined> {
  const visibleService = await tx.optional<{ id: string }>(
    `select s.id
     from services s
     where s.id = $1
       and s.is_active = true
       and s.deleted_at is null
       and (
         (s.photographer_id is not null and exists (
           select 1 from photographers ph where ph.id = s.photographer_id and ph.is_hidden = false
         ))
         or
         (s.studio_id is not null and exists (
           select 1 from studios st where st.id = s.studio_id and st.is_hidden = false and st.deleted_at is null
         ))
       )`,
    [serviceId],
  );
  if (!visibleService) return undefined;

  const rows = await tx.rows<ServiceAddOn>(
    `select id, service_id, name, description, price, is_active, created_at, updated_at
     from service_add_ons
     where service_id = $1 and is_active = true and deleted_at is null
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
