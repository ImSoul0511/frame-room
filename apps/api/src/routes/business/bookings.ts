import { thumbnailPath } from '../../services/media.js';
import { z } from 'zod';
import * as schemas from '@frameroom/shared';
import { requireCondition } from '../../lib/errors.js';
import * as bookings from '../../services/bookings.js';
import { admin, booking } from '../../services/access.js';
import type { BusinessContext } from './route.js';
import { empty } from './route.js';

export function registerBookings({ route, media }: BusinessContext) {
  route('GET', '/v1/bookings', empty, (_c, tx) =>
    tx.rows(
      'select * from bookings where private.can_read_booking(id) order by scheduled_start desc limit 100',
    ),
  );
  route('POST', '/v1/bookings', schemas.bookingInputSchema, (c, tx, i) =>
    bookings.createBooking(tx, c.userId, i),
  );
  route('POST', '/v1/booking-requests', schemas.initialBookingInputSchema, async (c, tx, i) => {
    for (const path of i.brief.requirements.referencePaths)
      await media.verifyReference(c.userId, 'brief-references', path);
    return bookings.requestBooking(tx, c.userId, i, c.requestKey);
  });
  route('GET', '/v1/bookings/:id/available-photographers', empty, (c, tx) =>
    bookings.availablePhotographers(tx, c.params.id),
  );
  route('POST', '/v1/bookings/:id/assignment', schemas.assignmentInputSchema, (c, tx, i) =>
    bookings.assignPhotographer(tx, c.params.id, c.userId, i),
  );
  route('POST', '/v1/bookings/:id/reassignment', schemas.reassignmentInputSchema, (c, tx, i) =>
    bookings.assignPhotographer(tx, c.params.id, c.userId, i),
  );
  route('POST', '/v1/bookings/:id/cancellation', schemas.bookingReasonSchema, (c, tx, i) =>
    bookings.proposeCancellation(tx, c.params.id, c.userId, i.reason),
  );
  route('PATCH', '/v1/bookings/:id/cancellation', schemas.cancellationResponseSchema, (c, tx, i) =>
    bookings.decideCancellation(tx, c.params.id, c.userId, i.accept),
  );
  route('GET', '/v1/bookings/:id', empty, (c, tx) => booking(tx, c.params.id));
  route('GET', '/v1/admin/booking-completions', empty, async (c, tx) => {
    await admin(tx);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(c.query.page ?? 1);
    return bookings.listCompletions(tx, page);
  });
  route(
    'PATCH',
    '/v1/admin/bookings/:id/completion-hold',
    schemas.completionHoldInputSchema,
    async (c, tx, i) => {
      await admin(tx);
      return bookings.setCompletionHold(tx, c.params.id, i);
    },
  );
  route(
    'POST',
    '/v1/bookings/:id/transitions',
    schemas.transitionInputSchema,
    (c, tx, i) => bookings.transition(tx, c.params.id, i),
    { status: 200 },
  );
  route('GET', '/v1/bookings/:id/workspace', empty, async (c, tx) => {
    const result = await bookings.workspace(tx, c.params.id, c.userId);
    result.images = await Promise.all(
      result.images.map(async (i) => {
        const image = i as { storagePath: string };
        const [url, thumbnailUrl] = await Promise.all([
          media.url('gallery-previews', image.storagePath),
          media.url('gallery-previews', thumbnailPath(image.storagePath)),
        ]);
        return { ...(i as object), url, thumbnailUrl };
      }),
    );
    result.deliveries = await Promise.all(
      result.deliveries.map(async (i) => {
        const file = i as { storagePath: string };
        return { ...(i as object), url: await media.url('deliveries', file.storagePath) };
      }),
    );
    return result;
  });
  route('POST', '/v1/bookings/:id/brief-versions', schemas.briefContentSchema, async (c, tx, i) => {
    const paths = i.requirements?.referencePaths ?? [];
    if (paths.length) await booking(tx, c.params.id);
    for (const path of paths) {
      const inherited = await tx.optional(
        "select id from brief_versions where booking_id=$1 and content->'requirements'->'referencePaths' ? $2 limit 1",
        [c.params.id, path],
      );
      if (!inherited) await media.verifyReference(c.userId, 'brief-references', path);
    }
    return bookings.createBrief(tx, c.params.id, c.userId, i);
  });
  route('GET', '/v1/bookings/:id/brief-versions/:briefId/reference', empty, async (c, tx) => {
    await booking(tx, c.params.id);
    const index = z.coerce.number().int().min(0).max(11).parse(c.query.index);
    const reference = await tx.one<{ path: string | null }>(
      "select content->'requirements'->'referencePaths'->>$3::integer as path from brief_versions where id=$1 and booking_id=$2",
      [c.params.briefId, c.params.id, index],
    );
    requireCondition(reference.path, 404, 'file_not_found');
    return { url: await media.url('brief-references', reference.path) };
  });
  route(
    'POST',
    '/v1/bookings/:id/brief-versions/:briefId/revision',
    schemas.bookingReasonSchema,
    (c, tx, i) => bookings.closeBrief(tx, c.params.id, c.params.briefId, c.userId, i.reason),
  );
  route(
    'POST',
    '/v1/bookings/:id/brief-versions/:briefId/approve',
    empty,
    (c, tx) => bookings.approveBrief(tx, c.params.id, c.params.briefId, c.userId),
    { status: 200 },
  );
}
