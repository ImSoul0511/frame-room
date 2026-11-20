import { z } from 'zod';
import * as schemas from '@frameroom/shared';
import { requireCondition } from '../../lib/errors.js';
import * as room from '../../services/collaboration.js';
import * as moderation from '../../services/moderation.js';
import { booking, providerSide } from '../../services/access.js';
import type { BusinessContext } from './route.js';
import { empty } from './route.js';

export function registerProofing({ route, media }: BusinessContext) {
  route(
    'POST',
    '/v1/bookings/:id/gallery-images',
    schemas.portfolioImageInputSchema,
    async (c, tx, i) => {
      const b = await booking(tx, c.params.id, true);
      await providerSide(tx, c.params.id);
      requireCondition(b.status === 'in_progress', 422, 'gallery_locked');
      const file = await media.verify('gallery-previews', i.storagePath, c.params.id);
      const gallery = await tx.one<{ id: string }>(
        "select id from galleries where booking_id=$1 and status='draft' for update",
        [c.params.id],
      );
      return tx.one(
        'insert into gallery_images(gallery_id,storage_path,width,height,caption,provenance) values($1,$2,$3,$4,$5,$6) returning *',
        [gallery.id, i.storagePath, file.width, file.height, i.caption, i.provenance],
      );
    },
  );
  route('POST', '/v1/bookings/:id/selections', schemas.selectionInputSchema, (c, tx, i) =>
    room.submitSelection(tx, c.userId, c.params.id, i),
  );
  route('POST', '/v1/bookings/:id/photo-feedback', schemas.photoFeedbackInputSchema, (c, tx, i) =>
    room.addPhotoFeedback(tx, c.params.id, c.userId, i),
  );
  route('POST', '/v1/bookings/:id/selections/revision-request', empty, (c, tx) =>
    room.requestSelectionRevision(tx, c.params.id, c.userId),
  );
  route(
    'POST',
    '/v1/bookings/:id/selections/reopen',
    empty,
    (c, tx) => room.reopenSelection(tx, c.params.id),
    { status: 200 },
  );
  route(
    'POST',
    '/v1/bookings/:id/deliveries',
    z.object({ storagePath: z.string().max(500), fileName: z.string().min(1).max(200) }),
    async (c, tx, i) => {
      const b = await booking(tx, c.params.id, true);
      await providerSide(tx, c.params.id);
      requireCondition(b.status === 'proofing', 422, 'delivery_locked');
      const round = await room.requireSubmittedSelection(tx, c.params.id);
      const file = await media.verify('deliveries', i.storagePath, c.params.id, false);
      return tx.one(
        'insert into deliveries(booking_id,storage_path,file_name,mime_type,selection_round) values($1,$2,$3,$4,$5) returning *',
        [c.params.id, i.storagePath, i.fileName, file.mimeType, round],
      );
    },
  );
  route('POST', '/v1/bookings/:id/reviews', schemas.reviewInputSchema, (c, tx, i) =>
    room.review(tx, c.userId, c.params.id, i),
  );
  route('PATCH', '/v1/bookings/:id/review', schemas.reviewInputSchema, (c, tx, i) =>
    moderation.resubmitReview(tx, c.params.id, c.userId, i),
  );
}
