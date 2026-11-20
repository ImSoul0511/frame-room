import { z } from 'zod';
import * as schemas from '@frameroom/shared';
import { requireCondition } from '../../lib/errors.js';
import * as room from '../../services/collaboration.js';
import * as conversations from '../../services/conversations.js';
import { access } from '../../services/access.js';
import type { BusinessContext } from './route.js';
import { empty } from './route.js';

export function registerCollaboration({ route, media }: BusinessContext) {
  route('PATCH', '/v1/me/notifications/:id', empty, (c, tx) =>
    tx.one(
      'update notifications set read_at=coalesce(read_at,now()) where id=$1 and recipient_id=$2 returning *',
      [c.params.id, c.userId],
    ),
  );
  route('GET', '/v1/conversations', empty, (_c, tx) => conversations.listConversations(tx));
  route('POST', '/v1/conversations', schemas.conversationInputSchema, (c, tx, i) =>
    conversations.contact(tx, {
      clientId: c.userId,
      photographerId: i.providerType === 'photographer' ? i.providerId : null,
      studioId: i.providerType === 'studio' ? i.providerId : null,
    }),
  );
  route('GET', '/v1/conversations/:id/messages', empty, (c, tx) =>
    conversations.listMessages(
      tx,
      c.params.id,
      c.query.before ? schemas.idSchema.parse(c.query.before) : null,
    ),
  );
  route(
    'POST',
    '/v1/conversations/:id/messages',
    schemas.conversationMessageInputSchema,
    async (c, tx, i) => {
      await conversations.readConversation(tx, c.params.id);
      if (i.storagePath)
        await media.verify('conversation-files', i.storagePath, `${c.userId}/${c.params.id}`);
      return conversations.persistMessage(tx, c.userId, c.params.id, null, i);
    },
  );
  route('GET', '/v1/conversation-messages/:id/file', empty, async (c, tx) => {
    const message = await tx.one<conversations.ConversationMessage>(
      'select * from room_messages where id=$1 and private.can_read_conversation_message(id)',
      [c.params.id],
    );
    requireCondition(message.storagePath, 404, 'file_not_found');
    return {
      bucket: message.roomId ? 'room-files' : 'conversation-files',
      storagePath: message.storagePath,
    };
  });
  route('POST', '/v1/shoot-rooms/:id/messages', schemas.messageInputSchema, async (c, tx, i) => {
    await access(tx, 'room', c.params.id);
    if (i.storagePath) await media.verify('room-files', i.storagePath, c.params.id);
    return room.sendMessage(tx, c.userId, c.params.id, i, c.requestKey);
  });
  route('POST', '/v1/shoot-rooms/:id/milestones', schemas.milestoneInputSchema, (c, tx, i) =>
    room.milestone(tx, c.userId, c.params.id, i),
  );
  route(
    'PATCH',
    '/v1/shoot-rooms/:id/milestones/:milestoneId',
    z.object({ status: z.enum(['todo', 'done']) }),
    async (c, tx, i) => {
      await room.openRoom(tx, c.params.id);
      return tx.one(
        'update room_milestones set status=$3,updated_by=$4,updated_at=now() where id=$1 and room_id=$2 returning *',
        [c.params.milestoneId, c.params.id, i.status, c.userId],
      );
    },
  );
  route('POST', '/v1/shoot-rooms/:id/decisions', schemas.decisionInputSchema, (c, tx, i) =>
    room.decision(tx, c.userId, c.params.id, i),
  );
  route(
    'PATCH',
    '/v1/shoot-rooms/:id/decisions/:decisionId',
    z.object({ status: z.enum(['agreed', 'rejected']) }),
    (c, tx, i) => room.updateDecision(tx, c.userId, c.params.id, c.params.decisionId, i.status),
  );
}
