import { z } from 'zod';
import {
  photographerInputSchema,
  profileInputSchema,
  studioInputSchema,
  invitationInputSchema,
  type Profile,
} from '@frameroom/shared';
import { Transaction } from '../repositories/database.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import { manager } from './access.js';

export const profileSql = `select p.*, array_remove(array['client',
 case when exists(select 1 from photographers where user_id=p.id) then 'photographer' end,
 case when exists(select 1 from studio_members m join studios s on s.id=m.studio_id where user_id=p.id and role='manager' and s.deleted_at is null) then 'studio_manager' end,
 case when exists(select 1 from user_roles where user_id=p.id) then 'system_admin' end],null) as roles from profiles p where id=$1`;

export async function getProfile(tx: Transaction, userId: string) {
  const result = await tx.optional<Profile>(profileSql, [userId]);
  if (!result) throw new ApiError(404, 'NOT_FOUND', 'profile_required');
  return result;
}
export async function createProfile(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof profileInputSchema>,
) {
  await tx.execute('select pg_advisory_xact_lock(hashtextextended($1,0))', [userId]);
  const existing = await tx.optional<Profile>(profileSql, [userId]);
  if (existing) return { data: existing, created: false };
  await tx.execute('insert into profiles(id,user_name,display_name) values($1,$2,$3)', [
    userId,
    input.userName,
    input.displayName,
  ]);
  return { data: await getProfile(tx, userId), created: true };
}
export async function createPhotographer(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof photographerInputSchema>,
) {
  await getProfile(tx, userId);
  return tx.one(
    'insert into photographers(user_id,display_name,bio,city,district,genres,styles) values($1,$2,$3,$4,$5,$6,$7) returning *',
    [userId, input.displayName, input.bio, input.city, input.district, input.genres, input.styles],
  );
}
export async function createStudio(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof studioInputSchema>,
) {
  requireCondition(
    await tx.optional('select id from photographers where user_id=$1', [userId]),
    422,
    'photographer_required',
  );
  const studio = await tx.one<{ id: string }>(
    'insert into studios(name,description,city,district,address,genres,created_by) values($1,$2,$3,$4,$5,$6,$7) returning *',
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
  await tx.execute("insert into studio_members(studio_id,user_id,role) values($1,$2,'manager')", [
    studio.id,
    userId,
  ]);
  return studio;
}
export async function invite(
  tx: Transaction,
  userId: string,
  studioId: string,
  input: z.infer<typeof invitationInputSchema>,
) {
  await manager(tx, studioId);
  await tx.one('select id from studios where id=$1 and deleted_at is null for update', [studioId]);
  requireCondition(
    !(await tx.optional(
      'select 1 from studio_members m join photographers p on p.user_id=m.user_id where m.studio_id=$1 and p.id=$2',
      [studioId, input.photographerId],
    )),
    409,
    'already_member',
  );
  return tx.one(
    'insert into studio_invitations(studio_id,photographer_id,role,invited_by) values($1,$2,$3,$4) returning *',
    [studioId, input.photographerId, input.role, userId],
  );
}
export async function respondInvitation(
  tx: Transaction,
  userId: string,
  id: string,
  status: string,
) {
  const invitation = await tx.one<{
    studioId: string;
    photographerId: string;
    role: string;
    status: string;
  }>('select * from studio_invitations where id=$1 for update', [id]);
  requireCondition(invitation.status === 'pending', 409, 'invitation_not_pending');
  await tx.one('select id from studios where id=$1 and deleted_at is null for update', [
    invitation.studioId,
  ]);
  if (status === 'revoked') await manager(tx, invitation.studioId);
  else {
    await tx.one('select id from photographers where id=$1 and user_id=$2', [
      invitation.photographerId,
      userId,
    ]);
    if (status === 'accepted')
      await tx.execute(
        'insert into studio_members(studio_id,user_id,role) values($1,$2,$3) on conflict do nothing',
        [invitation.studioId, userId, invitation.role],
      );
  }
  return tx.one(
    'update studio_invitations set status=$2,responded_at=now() where id=$1 returning *',
    [id, status],
  );
}
export async function leaveStudio(
  tx: Transaction,
  userId: string,
  studioId: string,
  targetId: string,
) {
  await tx.one('select id from studios where id=$1 for update', [studioId]);
  if (userId !== targetId) await manager(tx, studioId);
  await tx.one('delete from studio_members where studio_id=$1 and user_id=$2 returning user_id', [
    studioId,
    targetId,
  ]);
}
