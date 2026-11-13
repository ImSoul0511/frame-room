import type { Profile, photographerInputSchema, profileInputSchema } from '@frameroom/shared';
import type { z } from 'zod';

import type { OwnPhotographer } from '../schemas/own-photographer.js';
import type { Transaction } from './database.js';

type ProfileInput = z.output<typeof profileInputSchema>;
type PhotographerInput = z.output<typeof photographerInputSchema>;

// Roles are derived from rows, never stored from signup metadata or request bodies:
// photographer from its row, studio_manager from current membership, admin from user_roles.
const PROFILE_SQL = `
  select p.id, p.user_name, p.display_name, p.created_at,
    array_remove(array[
      'client',
      case when exists (select 1 from photographers where user_id = p.id) then 'photographer' end,
      case when exists (
        select 1 from studio_members m join studios s on s.id = m.studio_id
        where m.user_id = p.id and m.role = 'manager' and s.deleted_at is null
      ) then 'studio_manager' end,
      case when exists (select 1 from user_roles where user_id = p.id) then 'system_admin' end
    ], null) as roles
  from profiles p
  where p.id = $1`;

const PHOTOGRAPHER_COLUMNS =
  'id, user_id, display_name, bio, city, district, genres, styles, is_hidden, created_at, updated_at';

export function findProfile(tx: Transaction, userId: string) {
  return tx.optional<Profile>(PROFILE_SQL, [userId]);
}

/** Serializes concurrent creation by the same user until the transaction ends. */
export async function lockUser(tx: Transaction, userId: string) {
  await tx.execute('select pg_advisory_xact_lock(hashtextextended($1, 0))', [userId]);
}

export function insertProfile(tx: Transaction, userId: string, input: ProfileInput) {
  return tx.execute('insert into profiles (id, user_name, display_name) values ($1, $2, $3)', [
    userId,
    input.userName,
    input.displayName,
  ]);
}

/** Returns false when the caller has no profile row. */
export async function updateProfile(tx: Transaction, userId: string, input: ProfileInput) {
  const row = await tx.optional<{ id: string }>(
    'update profiles set user_name = $2, display_name = $3 where id = $1 returning id',
    [userId, input.userName, input.displayName],
  );
  return row !== undefined;
}

export function findPhotographer(tx: Transaction, userId: string) {
  return tx.optional<OwnPhotographer>(
    `select ${PHOTOGRAPHER_COLUMNS} from photographers where user_id = $1`,
    [userId],
  );
}

export function insertPhotographer(tx: Transaction, userId: string, input: PhotographerInput) {
  return tx.one<OwnPhotographer>(
    `insert into photographers (user_id, display_name, bio, city, district, genres, styles)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${PHOTOGRAPHER_COLUMNS}`,
    [userId, input.displayName, input.bio, input.city, input.district, input.genres, input.styles],
  );
}

export function updatePhotographer(tx: Transaction, userId: string, input: PhotographerInput) {
  return tx.optional<OwnPhotographer>(
    `update photographers
     set display_name = $2, bio = $3, city = $4, district = $5, genres = $6, styles = $7
     where user_id = $1 returning ${PHOTOGRAPHER_COLUMNS}`,
    [userId, input.displayName, input.bio, input.city, input.district, input.genres, input.styles],
  );
}
