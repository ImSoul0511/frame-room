import { z } from 'zod';
import {
  briefContentSchema,
  milestoneInputSchema,
  bookingInputSchema,
  scheduleInputSchema,
  type AiAction,
  type Booking,
} from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { project, providerSide } from './access.js';
import { requireCondition } from '../lib/errors.js';
import { createBooking, createBrief, reschedule } from './bookings.js';
import { milestone } from './collaboration.js';

export async function confirmAction(tx: Transaction, userId: string, id: string) {
  const a = await tx.one<AiAction & { proposedFor: string }>(
    'select * from ai_actions where id=$1 for update',
    [id],
  );
  requireCondition(a.proposedFor === userId, 404, 'not_found');
  const p = await project(tx, a.projectId, true);
  if (a.status === 'applied') return a;
  requireCondition(
    a.status === 'proposed' && Date.parse(a.expiresAt) > Date.now(),
    409,
    'action_expired',
  );
  requireCondition(p.version === a.projectVersion, 409, 'stale_action');
  const b = p.bookingId
    ? await tx.one<Booking>('select * from bookings where id=$1 for update', [p.bookingId])
    : null;
  requireCondition((b?.version ?? null) === a.bookingVersion, 409, 'stale_action');
  if (a.kind === 'update_brief') {
    const { brief } = z.object({ brief: briefContentSchema }).parse(a.payload);
    requireCondition(p.ownerId === userId || b, 403);
    if (b) await createBrief(tx, b.id, userId, brief);
    else
      await tx.execute('update creative_projects set brief=$2,version=version+1 where id=$1', [
        p.id,
        JSON.stringify(brief),
      ]);
  } else if (a.kind === 'create_milestone') {
    requireCondition(b, 422, 'booking_required');
    const room = await tx.one<{ id: string }>('select id from shoot_rooms where booking_id=$1', [
      b.id,
    ]);
    await milestone(tx, userId, room.id, milestoneInputSchema.parse(a.payload));
  } else if (a.kind === 'request_booking') {
    requireCondition(!b, 409, 'already_booked');
    const payload = bookingInputSchema.parse({ ...a.payload, projectId: p.id });
    await createBooking(tx, userId, payload);
  } else if (a.kind === 'reschedule_booking') {
    requireCondition(b, 422, 'booking_required');
    await reschedule(tx, b.id, scheduleInputSchema.parse({ ...a.payload, version: b.version }));
  } else if (a.kind === 'assign_photographer') {
    requireCondition(b && b.studioId, 422, 'studio_booking_required');
    const input = z.object({ assignedPhotographerId: z.string().uuid() }).parse(a.payload);
    if (b.status === 'pending') {
      await providerSide(tx, b.id);
      const allowed = await tx.one<{ allowed: boolean }>(
        'select private.is_manager($1) as allowed',
        [b.studioId],
      );
      requireCondition(allowed.allowed);
      await tx.one(
        'select p.id from photographers p join studio_members m on m.user_id=p.user_id where p.id=$1 and m.studio_id=$2',
        [input.assignedPhotographerId, b.studioId],
      );
      await tx.execute(
        'update bookings set assigned_photographer_id=$2,version=version+1 where id=$1',
        [b.id, input.assignedPhotographerId],
      );
    } else {
      const resources = await tx.rows<{ resourceId: string }>(
        'select resource_id from booking_resources where booking_id=$1',
        [b.id],
      );
      await reschedule(tx, b.id, {
        version: b.version,
        scheduledStart: b.scheduledStart,
        scheduledEnd: b.scheduledEnd,
        assignedPhotographerId: input.assignedPhotographerId,
        resourceIds: resources.map((r) => r.resourceId),
      });
    }
  }
  // Every confirmed write invalidates other proposals, even when only room data changed.
  await tx.execute('update creative_projects set version=version+1 where id=$1', [p.id]);
  return tx.one(
    "update ai_actions set status='applied',applied_by=$2,applied_at=now() where id=$1 returning *",
    [id, userId],
  );
}
