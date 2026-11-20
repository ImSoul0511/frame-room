import { z } from 'zod';
import * as schemas from '@frameroom/shared';
import * as moderation from '../../services/moderation.js';
import { admin } from '../../services/access.js';
import type { BusinessContext } from './route.js';
import { empty } from './route.js';

export function registerModeration({ route, media }: BusinessContext) {
  route('POST', '/v1/reports', schemas.reportInputSchema, (c, tx, i) =>
    moderation.reportContent(tx, c.userId, i),
  );
  route('GET', '/v1/admin/reports', empty, async (_c, tx) => {
    await admin(tx);
    return tx.rows('select * from content_reports order by created_at desc limit 100');
  });
  route('GET', '/v1/admin/reports/:id', empty, (c, tx) =>
    moderation.getReport(tx, c.params.id, (path) => media.url('portfolio-images', path)),
  );
  route('POST', '/v1/admin/reports/:id/decisions', schemas.reportDecisionSchema, (c, tx, i) =>
    moderation.decideReport(tx, c.params.id, c.userId, i),
  );
  route('GET', '/v1/admin/review-reassessments', empty, async (_c, tx) => {
    await admin(tx);
    return tx.rows(`select r.*, coalesce(history.events, '[]'::jsonb) as history from reviews r
      left join lateral (
        select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) as events
        from private.moderation_events e where e.target_type='review' and e.target_id=r.id
      ) history on true
      where r.reassessment_requested_at is not null and r.is_hidden and r.deleted_at is null
      order by r.reassessment_requested_at,r.id limit 100`);
  });
  route(
    'POST',
    '/v1/admin/review-reassessments/:id/decisions',
    schemas.reassessmentDecisionSchema,
    (c, tx, i) => moderation.decideReassessment(tx, c.params.id, c.userId, i.approve, i.reason),
  );
  route(
    'PATCH',
    '/v1/admin/reports/:id',
    z.object({ status: z.enum(['open', 'resolved']) }),
    async (c, tx, i) => {
      await admin(tx);
      return tx.one('update content_reports set status=$2 where id=$1 returning *', [
        c.params.id,
        i.status,
      ]);
    },
  );
  route(
    'POST',
    '/v1/admin/moderation',
    schemas.reportInputSchema
      .pick({ targetType: true, targetId: true })
      .extend({ isHidden: z.boolean() }),
    async (_c, tx, i) => {
      await admin(tx);
      const table = {
        portfolio: 'portfolios',
        portfolio_image: 'portfolio_images',
        photographer: 'photographers',
        studio: 'studios',
        review: 'reviews',
        message: 'room_messages',
      }[i.targetType];
      if (i.targetType === 'portfolio')
        return tx.one(`update portfolios set status=$2 where id=$1 returning *`, [
          i.targetId,
          i.isHidden ? 'hidden' : 'draft',
        ]);
      return tx.one(`update ${table} set is_hidden=$2 where id=$1 returning id`, [
        i.targetId,
        i.isHidden,
      ]);
    },
  );
}
