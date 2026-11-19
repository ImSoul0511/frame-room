import type { z } from 'zod';
import type { conversationMessageInputSchema } from '@frameroom/shared';
import { requireCondition } from '../lib/errors.js';
import type { Transaction } from '../repositories/database.js';

export type ConversationPair = {
  clientId: string;
  photographerId: string | null;
  studioId: string | null;
};

export async function findOrCreateConversation(tx: Transaction, pair: ConversationPair) {
  const { clientId, photographerId, studioId } = pair;
  await tx.execute('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `${clientId}:${photographerId ?? studioId}`,
  ]);
  const existing = await tx.optional<{ id: string }>(
    `select id from conversations where client_id=$1
     and photographer_id is not distinct from $2::uuid and studio_id is not distinct from $3::uuid`,
    [clientId, photographerId, studioId],
  );
  if (existing) return existing;
  return tx.one<{ id: string }>(
    'insert into conversations(client_id, photographer_id, studio_id) values($1,$2,$3) returning id',
    [clientId, photographerId, studioId],
  );
}

export async function contact(tx: Transaction, pair: ConversationPair) {
  const result = await tx.one<{ visible: boolean; owns: boolean }>(
    'select private.provider_visible($1,$2) as visible, private.owns_provider($1,$2) as owns',
    [pair.photographerId, pair.studioId],
  );
  requireCondition(result.visible, 404, 'provider_not_found');
  requireCondition(!result.owns, 422, 'self_booking');
  return findOrCreateConversation(tx, pair);
}

export async function readConversation(tx: Transaction, id: string) {
  const { allowed } = await tx.one<{ allowed: boolean }>(
    'select private.can_read_conversation($1) as allowed',
    [id],
  );
  requireCondition(allowed, 404, 'not_found');
}

export function listConversations(tx: Transaction) {
  return tx.rows(
    `select c.*, p.display_name as client_name, coalesce(s.name, ph.display_name) as provider_name
     from conversations c join profiles p on p.id=c.client_id
     left join studios s on s.id=c.studio_id left join photographers ph on ph.id=c.photographer_id
     where private.can_read_conversation(c.id)
     order by coalesce((select max(m.created_at) from room_messages m where m.conversation_id=c.id),
       c.created_at) desc, c.id desc limit 100`,
  );
}

export type ConversationMessage = {
  id: string;
  roomId: string | null;
  senderId: string | null;
  text: string;
  storagePath: string | null;
  createdAt: string;
};

export async function listMessages(tx: Transaction, id: string, before: string | null) {
  await readConversation(tx, id);
  const rows = await tx.rows<ConversationMessage & { bookingId: string | null }>(
    `select m.*, r.booking_id, p.display_name as sender_name
     from room_messages m left join shoot_rooms r on r.id=m.room_id
     left join profiles p on p.id=m.sender_id
     where m.conversation_id=$1 and private.can_read_conversation_message(m.id)
       and ($2::uuid is null or (m.created_at,m.id) <
          (select created_at,id from room_messages where id=$2 and conversation_id=$1
           and private.can_read_conversation_message(id)))
     order by m.created_at desc, m.id desc limit 51`,
    [id, before],
  );
  return { items: rows.slice(0, 50), before: rows.length > 50 ? rows[49].id : null };
}

export async function persistMessage(
  tx: Transaction,
  actorId: string,
  conversationId: string,
  roomId: string | null,
  input: z.output<typeof conversationMessageInputSchema>,
) {
  const created = await tx.optional<ConversationMessage>(
    `insert into room_messages(conversation_id,room_id,sender_id,text,storage_path,type,submission_id)
     values($1,$2,$3,$4,$5,$6,$7) on conflict on constraint uq_message_submission do nothing
     returning *`,
    [
      conversationId,
      roomId,
      actorId,
      input.text,
      input.storagePath,
      input.storagePath ? 'image' : 'text',
      input.submissionId,
    ],
  );
  if (created) return created;
  const existing = await tx.optional<ConversationMessage>(
    `select * from room_messages where sender_id=$1 and submission_id=$2
     and conversation_id=$3 and room_id is not distinct from $4::uuid
     and text=$5 and storage_path is not distinct from $6::text`,
    [actorId, input.submissionId, conversationId, roomId, input.text, input.storagePath],
  );
  requireCondition(existing, 409, 'submission_conflict');
  return existing;
}
