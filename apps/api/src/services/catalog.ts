import type { Transaction } from '../repositories/database.js';
import { manageProvider, manager } from './access.js';
import type { z } from 'zod';
import {
  portfolioInputSchema,
  serviceInputSchema,
  resourceInputSchema,
  addOnInputSchema,
  type Provider,
} from '@frameroom/shared';
import { requireCondition } from '../lib/errors.js';

export interface Owned {
  id: string;
  photographerId: string | null;
  studioId: string | null;
  ownerType: 'photographer' | 'studio';
}
export async function owner(tx: Transaction, userId: string, studioId?: string) {
  if (studioId) {
    await manager(tx, studioId);
    return { photographerId: null, studioId, ownerType: 'studio' as const };
  }
  const p = await tx.one<{ id: string }>('select id from photographers where user_id=$1', [userId]);
  return { photographerId: p.id, studioId: null, ownerType: 'photographer' as const };
}
export async function ownedRecord(tx: Transaction, table: 'portfolios' | 'services', id: string) {
  const record = await tx.one<Owned>(
    `select * from ${table} where id=$1 and deleted_at is null for update`,
    [id],
  );
  await manageProvider(tx, record.photographerId, record.studioId);
  return record;
}
export async function createService(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof serviceInputSchema>,
  studioId?: string,
) {
  const o = await owner(tx, userId, studioId);
  return tx.one(
    'insert into services(owner_type,photographer_id,studio_id,name,description,genre,duration_minutes,price,photo_count,retouched_count,is_active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *',
    [
      o.ownerType,
      o.photographerId,
      o.studioId,
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
}
export async function updateService(
  tx: Transaction,
  id: string,
  input: z.infer<typeof serviceInputSchema>,
) {
  await ownedRecord(tx, 'services', id);
  return tx.one(
    'update services set name=$2,description=$3,genre=$4,duration_minutes=$5,price=$6,photo_count=$7,retouched_count=$8,is_active=$9 where id=$1 returning *',
    [
      id,
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
}
export async function createPortfolio(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof portfolioInputSchema>,
  studioId?: string,
) {
  const o = await owner(tx, userId, studioId);
  return tx.one(
    "insert into portfolios(owner_type,photographer_id,studio_id,title,description,genre,status,published_at) values($1,$2,$3,$4,$5,$6,$7,case when $7='published' then now() end) returning *",
    [
      o.ownerType,
      o.photographerId,
      o.studioId,
      input.title,
      input.description,
      input.genre,
      input.status,
    ],
  );
}
export async function updatePortfolio(
  tx: Transaction,
  id: string,
  input: z.infer<typeof portfolioInputSchema>,
) {
  await ownedRecord(tx, 'portfolios', id);
  return tx.one(
    "update portfolios set title=$2,description=$3,genre=$4,status=$5,published_at=case when $5='published' then coalesce(published_at,now()) else null end where id=$1 returning *",
    [id, input.title, input.description, input.genre, input.status],
  );
}
export async function createResource(
  tx: Transaction,
  studioId: string,
  input: z.infer<typeof resourceInputSchema>,
) {
  await manager(tx, studioId);
  return tx.one(
    'insert into studio_resources(studio_id,name,type,description,is_active) values($1,$2,$3,$4,$5) returning *',
    [studioId, input.name, input.type, input.description, input.isActive],
  );
}
export async function createAddOn(
  tx: Transaction,
  serviceId: string,
  input: z.infer<typeof addOnInputSchema>,
) {
  await ownedRecord(tx, 'services', serviceId);
  return tx.one(
    'insert into service_add_ons(service_id,name,description,price,is_active) values($1,$2,$3,$4,$5) returning *',
    [serviceId, input.name, input.description, input.price, input.isActive],
  );
}
export async function discover(
  tx: Transaction,
  filters: { genre?: string; city?: string; district?: string; priceMax?: number },
  limit = 20,
  offset = 0,
  type?: string,
) {
  return tx.rows<Provider>(
    `select * from providers where ($1::text is null or $1=any(genres::text[])) and ($2::text is null or city ilike '%'||$2||'%') and ($3::text is null or district ilike '%'||$3||'%') and ($4::int is null or price_from<=$4) and ($7::text is null or type=$7) order by review_count desc,id limit $5 offset $6`,
    [
      filters.genre ?? null,
      filters.city ?? null,
      filters.district ?? null,
      filters.priceMax ?? null,
      limit,
      offset,
      type ?? null,
    ],
  );
}
export async function publicPortfolio(tx: Transaction, id: string, userId: string | null) {
  const p = await tx.one<Owned & { status: string }>(
    'select * from portfolios where id=$1 and deleted_at is null',
    [id],
  );
  if (p.status !== 'published') {
    requireCondition(userId, 404);
    await manageProvider(tx, p.photographerId, p.studioId);
  }
  requireCondition(
    await tx.optional('select 1 from providers where id=coalesce($1::uuid,$2::uuid)', [
      p.photographerId,
      p.studioId,
    ]),
    404,
  );
  return p;
}
