import { z } from 'zod';
import {
  bookingInputSchema,
  scheduleInputSchema,
  transitionInputSchema,
  briefContentSchema,
  type Booking,
  type CreativeProject,
  type Service,
} from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { booking, project } from './access.js';
import { requireCondition } from '../lib/errors.js';

export async function createBooking(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof bookingInputSchema>,
) {
  const p = await project(tx, input.projectId, true);
  requireCondition(p.ownerId === userId);
  requireCondition(!p.bookingId, 409, 'project_already_booked');
  const s = await tx.one<Service>(
    `select s.* from services s where id=$1 and is_active and deleted_at is null and private.provider_visible(photographer_id,studio_id) for share`,
    [input.serviceId],
  );
  const own = await tx.one<{ own: boolean }>('select private.owns_provider($1,$2) as own', [
    s.photographerId,
    s.studioId,
  ]);
  requireCondition(!own.own, 422, 'self_booking');
  const addons = await tx.rows<{ id: string; name: string; price: number }>(
    'select id,name,price from service_add_ons where id=any($1::uuid[]) and service_id=$2 and is_active and deleted_at is null for share',
    [input.addOnIds, s.id],
  );
  requireCondition(addons.length === input.addOnIds.length, 422, 'invalid_add_on');
  requireCondition(
    Date.parse(input.scheduledEnd) - Date.parse(input.scheduledStart) <= 86400000,
    422,
    'invalid_interval',
  );
  const result = await tx.one<Booking>(
    `insert into bookings(client_id,project_id,service_id,owner_type,photographer_id,studio_id,assigned_photographer_id,scheduled_start,scheduled_end,total_price,service_name,service_snapshot,note)
    values($1,$2,$3,$4,$5,$6,$5,$7,$8,$9,$10,$11,$12) returning *`,
    [
      userId,
      p.id,
      s.id,
      s.ownerType,
      s.photographerId,
      s.studioId,
      input.scheduledStart,
      input.scheduledEnd,
      s.price + addons.reduce((sum, a) => sum + a.price, 0),
      s.name,
      JSON.stringify({ ...s, addOns: addons }),
      input.note,
    ],
  );
  await tx.execute('update creative_projects set version=version+1 where id=$1', [p.id]);
  return result;
}
export async function transition(
  tx: Transaction,
  id: string,
  input: z.infer<typeof transitionInputSchema>,
) {
  return tx.one<Booking>('select * from public.frameroom_transition($1,$2,$3,$4,$5,$6,$7,$8)', [
    id,
    input.to,
    input.version,
    input.reason,
    input.scheduledStart ?? null,
    input.scheduledEnd ?? null,
    input.assignedPhotographerId ?? null,
    input.resourceIds,
  ]);
}
export async function reschedule(
  tx: Transaction,
  id: string,
  input: z.infer<typeof scheduleInputSchema>,
) {
  return tx.one<Booking>('select * from public.frameroom_reschedule($1,$2,$3,$4,$5,$6)', [
    id,
    input.version,
    input.scheduledStart,
    input.scheduledEnd,
    input.assignedPhotographerId ?? null,
    input.resourceIds,
  ]);
}
export async function createBrief(
  tx: Transaction,
  id: string,
  userId: string,
  content: z.infer<typeof briefContentSchema>,
) {
  const b = await booking(tx, id, true);
  requireCondition(['pending', 'confirmed', 'in_progress'].includes(b.status), 422, 'brief_locked');
  return tx.one(
    `insert into brief_versions(booking_id,version,content,created_by,client_approved,provider_approved)
    select $1,coalesce(max(version),0)+1,$2,$3,$4,not $4 from brief_versions where booking_id=$1 returning *`,
    [id, JSON.stringify(content), userId, b.clientId === userId],
  );
}
export async function approveBrief(
  tx: Transaction,
  bookingId: string,
  briefId: string,
  userId: string,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(['pending', 'confirmed', 'in_progress'].includes(b.status), 422, 'brief_locked');
  const v = await tx.one<{
    version: number;
    content: unknown;
    clientApproved: boolean;
    providerApproved: boolean;
  }>('select * from brief_versions where id=$1 and booking_id=$2 for update', [briefId, bookingId]);
  requireCondition(v.version >= (b.agreedBriefVersion ?? 0), 409, 'stale_brief');
  const updated = await tx.one<{ clientApproved: boolean; providerApproved: boolean }>(
    `update brief_versions set client_approved=client_approved or $2,provider_approved=provider_approved or not $2 where id=$1 returning *`,
    [briefId, b.clientId === userId],
  );
  if (updated.clientApproved && updated.providerApproved)
    await tx.execute('update bookings set agreed_brief_version=$2,version=version+1 where id=$1', [
      bookingId,
      v.version,
    ]);
  return updated;
}
export async function workspace(tx: Transaction, id: string, userId: string) {
  const b = await booking(tx, id);
  const p = await tx.one<CreativeProject>(
    'select *, $2::uuid as booking_id from creative_projects where id=$1',
    [b.projectId, id],
  );
  const room = await tx.optional<{ id: string; status: string }>(
    'select * from shoot_rooms where booking_id=$1',
    [id],
  );
  const isProvider = await tx.one<{ value: boolean }>('select private.provider_side($1) as value', [
    id,
  ]);
  const canManage = await tx.one<{ value: boolean }>(
    'select private.owns_provider($1,$2) as value',
    [b.photographerId, b.studioId],
  );
  const gallery = await tx.optional<{ id: string; status: string; round: number }>(
    "select * from galleries where booking_id=$1 and (status<>'draft' or $2)",
    [id, isProvider.value],
  );
  return {
    booking: b,
    project: p,
    room: room ?? null,
    isProvider: isProvider.value,
    canManage: canManage.value,
    isClient: b.clientId === userId,
    briefs: await tx.rows(
      'select * from brief_versions where booking_id=$1 order by version desc',
      [id],
    ),
    messages: room
      ? await tx.rows(
          'select * from (select * from room_messages where room_id=$1 and not is_hidden order by created_at desc,id desc limit 100) m order by created_at,id',
          [room.id],
        )
      : [],
    decisions: room
      ? await tx.rows('select * from room_decisions where room_id=$1 order by created_at', [
          room.id,
        ])
      : [],
    milestones: room
      ? await tx.rows(
          'select * from room_milestones where room_id=$1 order by due_at nulls last,created_at',
          [room.id],
        )
      : [],
    gallery: gallery ?? null,
    images: gallery
      ? await tx.rows('select * from gallery_images where gallery_id=$1 order by created_at', [
          gallery.id,
        ])
      : [],
    selections: gallery
      ? await tx.rows('select * from gallery_selections where gallery_id=$1 and round=$2', [
          gallery.id,
          gallery.round,
        ])
      : [],
    deliveries:
      isProvider.value || ['delivered', 'completed'].includes(b.status)
        ? await tx.rows('select * from deliveries where booking_id=$1', [id])
        : [],
    resources: await tx.rows('select * from booking_resources where booking_id=$1', [id]),
    review:
      (await tx.optional('select * from reviews where booking_id=$1 and deleted_at is null', [
        id,
      ])) ?? null,
  };
}
