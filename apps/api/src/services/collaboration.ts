import { z } from 'zod';
import {
  messageInputSchema,
  milestoneInputSchema,
  decisionInputSchema,
  reviewInputSchema,
  selectionInputSchema,
} from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { access, booking, providerSide } from './access.js';
import { requireCondition } from '../lib/errors.js';

export async function openRoom(tx: Transaction, id: string) {
  await access(tx, 'room', id);
  const room = await tx.one<{ id: string; bookingId: string; status: string }>(
    'select * from shoot_rooms where id=$1 for update',
    [id],
  );
  requireCondition(room.status === 'open', 422, 'room_closed');
  return room;
}
export async function sendMessage(
  tx: Transaction,
  userId: string,
  roomId: string,
  input: z.infer<typeof messageInputSchema>,
) {
  await openRoom(tx, roomId);
  return tx.one(
    'insert into room_messages(room_id,sender_id,text,storage_path,type) values($1,$2,$3,$4,$5) returning *',
    [roomId, userId, input.text, input.storagePath, input.storagePath ? 'image' : 'text'],
  );
}
export async function milestone(
  tx: Transaction,
  userId: string,
  roomId: string,
  input: z.infer<typeof milestoneInputSchema>,
) {
  await openRoom(tx, roomId);
  return tx.one(
    'insert into room_milestones(room_id,title,due_at,created_by) values($1,$2,$3,$4) returning *',
    [roomId, input.title, input.dueAt, userId],
  );
}
export async function decision(
  tx: Transaction,
  userId: string,
  roomId: string,
  input: z.infer<typeof decisionInputSchema>,
) {
  await openRoom(tx, roomId);
  return tx.one(
    'insert into room_decisions(room_id,title,description,proposed_by) values($1,$2,$3,$4) returning *',
    [roomId, input.title, input.description, userId],
  );
}
export async function updateDecision(
  tx: Transaction,
  userId: string,
  roomId: string,
  id: string,
  status: string,
) {
  const room = await openRoom(tx, roomId);
  const b = await booking(tx, room.bookingId);
  const d = await tx.one<{ proposedBy: string; status: string }>(
    'select * from room_decisions where id=$1 and room_id=$2 for update',
    [id, roomId],
  );
  requireCondition(d.status === 'proposed', 409, 'decision_resolved');
  requireCondition(
    (d.proposedBy === b.clientId) !== (userId === b.clientId),
    403,
    'counterparty_required',
  );
  return tx.one('update room_decisions set status=$2 where id=$1 returning *', [id, status]);
}
export async function submitSelection(
  tx: Transaction,
  userId: string,
  bookingId: string,
  input: z.infer<typeof selectionInputSchema>,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(b.clientId === userId);
  const g = await tx.one<{ id: string; status: string; round: number }>(
    'select * from galleries where booking_id=$1 for update',
    [bookingId],
  );
  requireCondition(
    b.status === 'proofing' && g.status === 'open_for_selection',
    422,
    'selection_locked',
  );
  const images = await tx.rows<{ id: string }>(
    'select id from gallery_images where gallery_id=$1 and id=any($2::uuid[])',
    [g.id, input.imageIds],
  );
  requireCondition(images.length === input.imageIds.length, 422, 'invalid_selection');
  for (const image of images)
    await tx.execute(
      'insert into gallery_selections(gallery_id,image_id,round,selected_by) values($1,$2,$3,$4)',
      [g.id, image.id, g.round, userId],
    );
  return tx.one("update galleries set status='selection_submitted' where id=$1 returning *", [
    g.id,
  ]);
}
export async function reopenSelection(tx: Transaction, bookingId: string) {
  const b = await booking(tx, bookingId, true);
  await providerSide(tx, bookingId);
  requireCondition(b.status === 'proofing', 422, 'selection_locked');
  return tx.one(
    "update galleries set status='open_for_selection',round=round+1 where booking_id=$1 and status='selection_submitted' returning *",
    [bookingId],
  );
}
export async function review(
  tx: Transaction,
  userId: string,
  bookingId: string,
  input: z.infer<typeof reviewInputSchema>,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(b.clientId === userId);
  requireCondition(b.status === 'completed', 422, 'booking_not_completed');
  return tx.one(
    'insert into reviews(booking_id,author_id,photographer_id,studio_id,rating,comment) values($1,$2,$3,$4,$5,$6) returning *',
    [bookingId, userId, b.photographerId, b.studioId, input.rating, input.comment],
  );
}
