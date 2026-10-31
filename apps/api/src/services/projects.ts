import { z } from 'zod';
import { projectInputSchema, projectPatchSchema } from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { project } from './access.js';
import { requireCondition } from '../lib/errors.js';

export async function createProject(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof projectInputSchema>,
) {
  return tx.one(
    'insert into creative_projects(owner_id,title,idea) values($1,$2,$3) returning *,null::uuid as booking_id',
    [userId, input.title, input.idea],
  );
}
export async function patchProject(
  tx: Transaction,
  id: string,
  userId: string,
  input: z.infer<typeof projectPatchSchema>,
) {
  const current = await project(tx, id, true);
  requireCondition(current.ownerId === userId, 403, 'project_owner_required');
  if (input.selectedArtifactIds) {
    const matches = await tx.rows(
      'select id from ai_artifacts where project_id=$1 and id=any($2::uuid[])',
      [id, input.selectedArtifactIds],
    );
    requireCondition(matches.length === input.selectedArtifactIds.length, 422, 'invalid_reference');
    await tx.execute('update creative_projects set selected_artifact_ids=$2 where id=$1', [
      id,
      input.selectedArtifactIds,
    ]);
  }
  if (current.bookingId) {
    const b = await tx.one<{ status: string }>(
      'select status from bookings where id=$1 for update',
      [current.bookingId],
    );
    requireCondition(
      ['pending', 'confirmed', 'in_progress'].includes(b.status),
      422,
      'project_closed',
    );
  }
  return tx.one(
    'update creative_projects set title=$2,idea=$3,brief=$4,reference_paths=$5,version=version+1 where id=$1 returning *, $6::uuid as booking_id',
    [
      id,
      input.title ?? current.title,
      input.idea ?? current.idea,
      JSON.stringify(input.brief ?? current.brief),
      input.referencePaths ?? current.referencePaths,
      current.bookingId,
    ],
  );
}
