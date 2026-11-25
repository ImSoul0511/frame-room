import type { z } from 'zod';
import type { projectPatchSchema, CreativeProject } from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import * as projects from '../repositories/projects.js';
import { requireCondition } from '../lib/errors.js';
import type { MediaService } from './media.js';

export async function deleteProject(tx: Transaction, userId: string, id: string) {
  const current = await projects.findProject(tx, id, true);
  requireCondition(current.ownerId === userId, 403, 'project_owner_required');
  const booking = await tx.optional('select id from bookings where project_id=$1 limit 1', [id]);
  requireCondition(!booking, 409, 'project_has_booking');
  const activeJob = await tx.optional(
    "select id from ai_jobs where project_id=$1 and status in ('queued','running') limit 1",
    [id],
  );
  requireCondition(!activeJob, 409, 'project_ai_pending');
  await tx.execute('update creative_projects set deleted_at=now(),version=version+1 where id=$1', [
    id,
  ]);
  return { deleted: true as const };
}

export async function patchProject(
  tx: Transaction,
  userId: string,
  id: string,
  input: z.output<typeof projectPatchSchema>,
  media: MediaService,
) {
  const current = await projects.findProject(tx, id, true);
  requireCondition(current.ownerId === userId, 403, 'project_owner_required');
  if (current.bookingId) {
    const booking = await tx.one<{ status: string }>(
      'select status from bookings where id=$1 for update',
      [current.bookingId],
    );
    requireCondition(
      ['pending', 'confirmed', 'in_progress'].includes(booking.status),
      422,
      'project_closed',
    );
  }
  if (input.selectedArtifactIds) {
    requireCondition(
      new Set(input.selectedArtifactIds).size === input.selectedArtifactIds.length,
      400,
      'duplicate_artifact',
    );
    const matches = await tx.rows(
      'select id from ai_artifacts where project_id=$1 and id=any($2::uuid[])',
      [id, input.selectedArtifactIds],
    );
    requireCondition(matches.length === input.selectedArtifactIds.length, 422, 'invalid_reference');
  }
  for (const path of input.referencePaths ?? [])
    await media.verify('brief-references', path, userId);
  return tx.one<CreativeProject>(
    `update creative_projects set title=$2,idea=$3,brief=$4,reference_paths=$5,selected_artifact_ids=$6,version=version+1 where id=$1 returning *, $7::uuid as booking_id`,
    [
      id,
      input.title ?? current.title,
      input.idea ?? current.idea,
      JSON.stringify(input.brief ?? current.brief),
      input.referencePaths ?? current.referencePaths,
      input.selectedArtifactIds ?? current.selectedArtifactIds,
      current.bookingId,
    ],
  );
}
