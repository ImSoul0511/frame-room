import { z } from 'zod';
import * as schemas from '@frameroom/shared';
import { requireCondition } from '../../lib/errors.js';
import { assertProviderOwnership } from '../../services/catalog.js';
import * as bookings from '../../services/bookings.js';
import { manager } from '../../services/access.js';
import type { BusinessContext } from './route.js';
import { empty } from './route.js';

export function registerStudio({ route }: BusinessContext) {
  route('GET', '/v1/studios/:id/dashboard', empty, async (c, tx) => {
    await manager(tx, c.params.id);
    return {
      stats: await tx.one(
        `select count(*)::int as bookings,count(*) filter(where status='completed')::int as completed,coalesce(sum(total_price) filter(where status='completed'),0)::bigint as completed_value from bookings where studio_id=$1`,
        [c.params.id],
      ),
      upcoming: await tx.rows(
        'select * from bookings where studio_id=$1 and scheduled_end>now() order by scheduled_start limit 20',
        [c.params.id],
      ),
      resources: await tx.rows(
        'select * from studio_resources where studio_id=$1 and deleted_at is null',
        [c.params.id],
      ),
    };
  });
  route('PATCH', '/v1/bookings/:id/schedule', schemas.scheduleInputSchema, (c, tx, i) =>
    bookings.reschedule(tx, c.params.id, i),
  );
  route('GET', '/v1/me/timeline', empty, async (c, tx) => {
    const range = z
      .object({ from: z.string().datetime(), to: z.string().datetime() })
      .parse(c.query);
    requireCondition(
      Date.parse(range.to) > Date.parse(range.from) &&
        Date.parse(range.to) - Date.parse(range.from) <= 62 * 86400000,
      400,
      'invalid_range',
    );
    return tx.rows(
      'select * from bookings where private.can_read_booking(id) and scheduled_start>=$1 and scheduled_start<$2 order by scheduled_start',
      [range.from, range.to],
    );
  });
  route('GET', '/v1/me/schedule', empty, (_c, tx) =>
    tx.rows(
      'select e.*,lower(during) as starts_at,upper(during) as ends_at from schedule_entries e where private.owns_provider(e.photographer_id,null) or exists(select 1 from studio_resources r where r.id=e.resource_id and private.is_manager(r.studio_id)) order by lower(during) desc limit 200',
    ),
  );
  route('POST', '/v1/me/schedule/blocks', schemas.blockInputSchema, async (c, tx, i) => {
    let pid: string | null = null;
    if (i.resourceId) {
      const r = await tx.one<{ studioId: string }>(
        'select studio_id from studio_resources where id=$1 and is_active and deleted_at is null',
        [i.resourceId],
      );
      await manager(tx, r.studioId);
    } else
      pid = (
        await tx.one<{ id: string }>('select id from photographers where user_id=$1', [c.userId])
      ).id;
    return tx.one(
      "insert into schedule_entries(photographer_id,resource_id,during,label) values($1,$2,tstzrange($3,$4,'[)'),$5) returning *",
      [pid, i.resourceId ?? null, i.startsAt, i.endsAt, i.label],
    );
  });
  route(
    'DELETE',
    '/v1/me/schedule/blocks/:id',
    empty,
    async (c, tx) => {
      const e = await tx.one<{
        photographerId: string | null;
        resourceId: string | null;
        bookingId: string | null;
      }>('select * from schedule_entries where id=$1 for update', [c.params.id]);
      requireCondition(!e.bookingId, 422, 'booking_reservation');
      if (e.photographerId)
        await assertProviderOwnership(tx, c.userId, {
          photographerId: e.photographerId,
          studioId: null,
        });
      else {
        const r = await tx.one<{ studioId: string }>(
          'select studio_id from studio_resources where id=$1',
          [e.resourceId],
        );
        await manager(tx, r.studioId);
      }
      await tx.execute('delete from schedule_entries where id=$1', [c.params.id]);
    },
    { status: 204 },
  );
}
