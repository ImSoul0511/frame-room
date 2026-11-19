import type { z } from 'zod';
import type { reportDecisionSchema, reportInputSchema, reviewInputSchema } from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { requireCondition } from '../lib/errors.js';
import { admin, booking } from './access.js';

const publicConditions = {
  portfolio: `select pf.id from portfolios pf where pf.id=$1 and pf.status='published'
    and pf.deleted_at is null and private.provider_visible(pf.photographer_id,pf.studio_id) for share`,
  portfolio_image: `select i.id from portfolio_images i join portfolios pf on pf.id=i.portfolio_id
    where i.id=$1 and not i.is_hidden and pf.status='published' and pf.deleted_at is null
      and private.provider_visible(pf.photographer_id,pf.studio_id) for share of i,pf`,
  review: `select id from reviews where id=$1 and not is_hidden and deleted_at is null
    and private.provider_visible(photographer_id,studio_id) for share`,
};
type PublicTarget = keyof typeof publicConditions;
const isPublicTarget = (target: string): target is PublicTarget =>
  Object.hasOwn(publicConditions, target);

export async function reportContent(
  tx: Transaction,
  actorId: string,
  input: z.output<typeof reportInputSchema>,
) {
  requireCondition(isPublicTarget(input.targetType), 422, 'report_target_unavailable');
  const target = await tx.optional(publicConditions[input.targetType], [input.targetId]);
  requireCondition(target, 404, 'report_target_unavailable');
  return tx.one(
    'insert into content_reports(reporter_id,target_type,target_id,reason,description) values($1,$2,$3,$4,$5) returning *',
    [actorId, input.targetType, input.targetId, input.reason, input.description],
  );
}

type ModerationTarget = { targetType: string; targetId: string };
async function audit(
  tx: Transaction,
  actorId: string,
  target: ModerationTarget,
  action: string,
  reason: string,
  reportId: string | null = null,
  previousReview?: unknown,
) {
  await tx.execute(
    `insert into private.moderation_events(report_id,target_type,target_id,actor_id,action,reason,previous_review)
     values($1,$2,$3,$4,$5,$6,$7)`,
    [
      reportId,
      target.targetType,
      target.targetId,
      actorId,
      action,
      reason,
      previousReview === undefined ? null : JSON.stringify(previousReview),
    ],
  );
}

export async function getReport(
  tx: Transaction,
  id: string,
  imageUrl: (path: string) => Promise<string>,
) {
  await admin(tx);
  const report = await tx.one<ModerationTarget>('select * from content_reports where id=$1', [id]);
  const targets = {
    portfolio: 'portfolios',
    portfolio_image: 'portfolio_images',
    review: 'reviews',
    photographer: 'photographers',
    studio: 'studios',
  } as const;
  const table = Object.hasOwn(targets, report.targetType)
    ? targets[report.targetType as keyof typeof targets]
    : null;
  const target = table
    ? ((await tx.optional<{
        storagePath?: string;
        photographerId?: string;
        studioId?: string;
        bookingId?: string;
        portfolioId?: string;
      }>(`select * from ${table} where id=$1`, [report.targetId])) ?? null)
    : null;
  return {
    report,
    target,
    imageUrl:
      report.targetType === 'portfolio_image' &&
      target?.storagePath &&
      !/^https?:\/\//i.test(target.storagePath)
        ? await imageUrl(target.storagePath)
        : null,
    history: await tx.rows(
      'select * from private.moderation_events where target_type=$1 and target_id=$2 order by created_at,id',
      [report.targetType, report.targetId],
    ),
  };
}

export async function decideReport(
  tx: Transaction,
  id: string,
  actorId: string,
  input: z.output<typeof reportDecisionSchema>,
) {
  await admin(tx);
  const report = await tx.one<ModerationTarget & { status: string }>(
    'select * from content_reports where id=$1 for update',
    [id],
  );
  requireCondition(report.status === 'open', 409, 'report_already_resolved');
  if (input.decision === 'actioned') {
    requireCondition(isPublicTarget(report.targetType), 422, 'report_target_unavailable');
    if (report.targetType === 'portfolio')
      await tx.one(
        "update portfolios set status='hidden' where id=$1 and deleted_at is null returning id",
        [report.targetId],
      );
    else if (report.targetType === 'portfolio_image')
      await tx.one('update portfolio_images set is_hidden=true where id=$1 returning id', [
        report.targetId,
      ]);
    else
      await tx.one(
        'update reviews set is_hidden=true,moderation_reason=$2,reassessment_requested_at=null where id=$1 and deleted_at is null returning id',
        [report.targetId, input.reason],
      );
  }
  await audit(tx, actorId, report, input.decision, input.reason, id);
  if (input.decision === 'deferred') return report;
  return tx.one("update content_reports set status='resolved',outcome=$2 where id=$1 returning *", [
    id,
    input.decision,
  ]);
}

export async function resubmitReview(
  tx: Transaction,
  bookingId: string,
  actorId: string,
  input: z.output<typeof reviewInputSchema>,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(b.clientId === actorId);
  requireCondition(b.status === 'completed', 422, 'booking_not_completed');
  const prior = await tx.one<{ id: string; reassessmentRequestedAt: string | null }>(
    `select * from reviews where booking_id=$1 and author_id=$2 and is_hidden and deleted_at is null
      and moderation_reason is not null for update`,
    [bookingId, actorId],
  );
  requireCondition(!prior.reassessmentRequestedAt, 409, 'review_already_pending');
  await audit(
    tx,
    actorId,
    { targetType: 'review', targetId: prior.id },
    'resubmitted',
    '',
    null,
    prior,
  );
  return tx.one(
    'update reviews set rating=$2,comment=$3,reassessment_requested_at=now() where id=$1 returning *',
    [prior.id, input.rating, input.comment],
  );
}

export async function decideReassessment(
  tx: Transaction,
  id: string,
  actorId: string,
  approve: boolean,
  reason: string,
) {
  await admin(tx);
  const result = await tx.one(
    `update reviews set is_hidden=not $2,moderation_reason=case when $2 then null else $3 end,
      reassessment_requested_at=null where id=$1 and is_hidden and deleted_at is null
      and reassessment_requested_at is not null returning *`,
    [id, approve, reason],
  );
  await audit(
    tx,
    actorId,
    { targetType: 'review', targetId: id },
    approve ? 'approved' : 'rejected',
    reason,
  );
  return result;
}
