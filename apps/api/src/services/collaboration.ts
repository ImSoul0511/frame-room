import { z } from 'zod';
import {
  messageInputSchema,
  milestoneInputSchema,
  decisionInputSchema,
  reviewInputSchema,
  selectionInputSchema,
  photoFeedbackInputSchema,
  type Booking,
} from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { access, booking, providerSide } from './access.js';
import { requireCondition } from '../lib/errors.js';
import {
  findOrCreateConversation,
  persistMessage,
  type ConversationPair,
} from './conversations.js';

export async function openRoom(tx: Transaction, id: string) {
  await access(tx, 'room', id);
  const roomBooking = await tx.one<{ bookingId: string }>(
    'select booking_id from shoot_rooms where id=$1',
    [id],
  );
  const current = await booking(tx, roomBooking.bookingId, true);
  requireCondition(['confirmed', 'in_progress'].includes(current.status), 422, 'room_closed');
  await access(tx, 'room', id);
  const room = await tx.one<{ id: string; bookingId: string; status: string }>(
    'select * from shoot_rooms where id=$1 for update',
    [id],
  );
  requireCondition(room.status === 'open', 422, 'room_closed');
  return room;
}

export function proofingTerms(b: Booking & { serviceSnapshot?: unknown }) {
  const parsed = z
    .object({
      selectionQuota: z.number().int().min(1).max(200).nullish(),
      revisionLimit: z.number().int().min(0).max(100).nullish(),
      retouchedCount: z.number().int().nonnegative().optional(),
    })
    .safeParse(b.serviceSnapshot);
  const terms = parsed.data;
  return {
    quota: terms?.selectionQuota ?? Math.min(200, Math.max(1, terms?.retouchedCount ?? 5)),
    revisions: terms?.revisionLimit ?? 2,
  };
}
export async function sendMessage(
  tx: Transaction,
  userId: string,
  roomId: string,
  input: z.infer<typeof messageInputSchema>,
  submissionId: string,
) {
  await access(tx, 'room', roomId);
  const pair = await tx.one<ConversationPair>(
    'select b.client_id,b.photographer_id,b.studio_id from bookings b join shoot_rooms r on r.booking_id=b.id where r.id=$1',
    [roomId],
  );
  const conversation = await findOrCreateConversation(tx, pair);
  await openRoom(tx, roomId);
  return persistMessage(tx, userId, conversation.id, roomId, { ...input, submissionId });
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
  requireCondition(input.imageIds.length <= proofingTerms(b).quota, 422, 'selection_quota');
  const images = await tx.rows<{ id: string }>(
    'select id from gallery_images where gallery_id=$1 and id=any($2::uuid[])',
    [g.id, input.imageIds],
  );
  requireCondition(images.length === input.imageIds.length, 422, 'invalid_selection');
  if (g.round > 1)
    await tx.execute('delete from gallery_selections where gallery_id=$1 and round=$2', [
      g.id,
      g.round,
    ]);
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
  const gallery = await tx.one<{ round: number; revisionRequestedAt: string | null }>(
    "select * from galleries where booking_id=$1 and status='selection_submitted' for update",
    [bookingId],
  );
  requireCondition(gallery.round <= proofingTerms(b).revisions, 422, 'revision_limit');
  requireCondition(gallery.revisionRequestedAt, 422, 'revision_request_required');
  const updated = await tx.one(
    "update galleries set status='open_for_selection',round=round+1,revision_requested_at=null where booking_id=$1 returning *",
    [bookingId],
  );
  await tx.execute(
    `insert into gallery_selections(gallery_id,image_id,round,selected_by)
     select gallery_id,image_id,round+1,selected_by from gallery_selections where gallery_id=(
       select id from galleries where booking_id=$1) and round=$2`,
    [bookingId, gallery.round],
  );
  return updated;
}

export async function requestSelectionRevision(
  tx: Transaction,
  bookingId: string,
  actorId: string,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(b.clientId === actorId);
  requireCondition(b.status === 'proofing', 422, 'selection_locked');
  const gallery = await tx.one<{ round: number }>(
    "select round from galleries where booking_id=$1 and status='selection_submitted' for update",
    [bookingId],
  );
  requireCondition(gallery.round <= proofingTerms(b).revisions, 422, 'revision_limit');
  return tx.one(
    'update galleries set revision_requested_at=coalesce(revision_requested_at,now()) where booking_id=$1 returning *',
    [bookingId],
  );
}

export async function addPhotoFeedback(
  tx: Transaction,
  bookingId: string,
  actorId: string,
  input: z.output<typeof photoFeedbackInputSchema>,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(b.clientId === actorId);
  requireCondition(b.status === 'proofing', 422, 'selection_locked');
  const g = await tx.one<{ id: string; round: number; status: string }>(
    'select g.* from galleries g join gallery_images i on i.gallery_id=g.id where g.booking_id=$1 and i.id=$2 for update of g',
    [bookingId, input.imageId],
  );
  requireCondition(
    g.status === 'open_for_selection' && g.round === input.round,
    422,
    'selection_locked',
  );
  return tx.one(
    'insert into photo_feedback(image_id,round,author_id,note,x,y) values($1,$2,$3,$4,$5,$6) returning *',
    [input.imageId, input.round, actorId, input.note, input.x, input.y],
  );
}

export async function requireSubmittedSelection(tx: Transaction, bookingId: string) {
  const gallery = await tx.optional<{ round: number }>(
    "select round from galleries where booking_id=$1 and status='selection_submitted' and revision_requested_at is null",
    [bookingId],
  );
  requireCondition(gallery, 422, 'selection_delivery_required');
  return gallery.round;
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
    [
      bookingId,
      userId,
      b.assignedPhotographerId ?? b.photographerId,
      b.studioId,
      input.rating,
      input.comment,
    ],
  );
}
