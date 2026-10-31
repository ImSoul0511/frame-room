import { z } from 'zod';
import { jobInputSchema, type AiJob, type Language } from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { project, providerSide } from './access.js';
import { requireCondition } from '../lib/errors.js';
import type { ApiEnv } from '../config/env.js';

export async function enqueue(
  tx: Transaction,
  userId: string,
  projectId: string,
  input: z.infer<typeof jobInputSchema>,
  requestKey: string,
  language: Language = 'en',
) {
  const p = await project(tx, projectId, true);
  const existing = await tx.optional<AiJob & { userId: string }>(
    'select * from ai_jobs where request_key=$1',
    [requestKey],
  );
  if (existing) {
    requireCondition(
      existing.userId === userId && existing.projectId === projectId,
      409,
      'request_key_reused',
    );
    return existing;
  }
  if (input.kind === 'edit' || input.kind === 'cull') {
    requireCondition(p.bookingId, 422, 'booking_required');
    await providerSide(tx, p.bookingId);
    const b = await tx.one<{ status: string }>('select status from bookings where id=$1', [
      p.bookingId,
    ]);
    requireCondition(['in_progress', 'proofing'].includes(b.status), 422, 'editing_locked');
    requireCondition(
      input.kind === 'edit' ? input.imageIds.length === 1 : input.imageIds.length > 0,
      400,
      'images_required',
    );
    const valid = await tx.rows(
      'select i.id from gallery_images i join galleries g on g.id=i.gallery_id where g.booking_id=$1 and i.id=any($2::uuid[])',
      [p.bookingId, input.imageIds],
    );
    requireCondition(valid.length === input.imageIds.length, 422, 'invalid_images');
  }
  const job = await tx.one<AiJob>(
    `insert into ai_jobs(project_id,user_id,kind,input,request_key) values($1,$2,$3,$4,$5) returning *`,
    [projectId, userId, input.kind, JSON.stringify({ ...input, language }), requestKey],
  );
  await tx.execute('select frameroom_enqueue_job($1)', [job.id]);
  return job;
}
export async function enqueueIndex(
  tx: Transaction,
  userId: string,
  imageId: string,
  env: ApiEnv,
  requestKey: string,
) {
  if (!env.AI_GATEWAY_API_KEY) return null;
  const job = await tx.one<AiJob>(
    "insert into ai_jobs(user_id,kind,input,request_key) values($1,'index',$2,$3) returning *",
    [userId, JSON.stringify({ imageId }), requestKey],
  );
  await tx.execute('select frameroom_enqueue_job($1)', [job.id]);
  return job;
}
