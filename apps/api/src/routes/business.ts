import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { v7 as uuidv7 } from 'uuid';
import * as schemas from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { authenticateVerified } from '../lib/auth.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import type { ApiDependencies, ApiModule, RouteMethod } from '../plugins/route.js';
import { assertProviderOwnership, requirePortfolioOwnership } from '../services/catalog.js';
import * as bookings from '../services/bookings.js';
import * as room from '../services/collaboration.js';
import * as conversations from '../services/conversations.js';
import * as moderation from '../services/moderation.js';
import { access, admin, booking, manager, project, providerSide } from '../services/access.js';
import { MediaService } from '../services/media.js';
import { AiService } from '../services/ai.js';
import { enqueue, enqueueIndex } from '../services/ai-jobs.js';
import { confirmAction } from '../services/ai-actions.js';
import { search } from '../services/search.js';
import { aiStreamError } from '../services/ai-language.js';

type Context = {
  userId: string;
  params: Record<string, string>;
  query: Record<string, string>;
  requestKey: string;
  language: schemas.Language;
};
export const businessModule: ApiModule = {
  name: 'business',
  register(app, deps) {
    void app.register(async (scope) => {
      await scope.register(rateLimit, {
        max: 120,
        timeWindow: '1 minute',
        errorResponseBuilder: () =>
          new ApiError(429, 'RATE_LIMITED', 'request_limit', 'Too many requests'),
      });
      registerBusiness(scope, deps);
    });
  },
};

const empty = z.object({});
function registerBusiness(app: FastifyInstance, deps: ApiDependencies) {
  const { db, authenticate, env, openApi } = deps;
  const media = new MediaService(env);
  const ai = new AiService(env, db, media);

  function route<T extends z.ZodTypeAny>(
    method: RouteMethod,
    url: string,
    schema: T,
    handle: (ctx: Context, tx: Transaction, input: z.infer<T>) => Promise<unknown>,
    options: { status?: number } = {},
  ) {
    const status = options.status ?? (method === 'POST' ? 201 : 200);
    openApi.add({
      method,
      url,
      summary: `${method} ${url}`,
      isPublic: false,
      status,
      successStatuses: [],
      body: method === 'GET' || method === 'DELETE' ? undefined : schema,
      params: z.object(
        Object.fromEntries([...url.matchAll(/:([a-zA-Z]+)/g)].map((m) => [m[1], schemas.idSchema])),
      ),
      response: z.unknown(),
      envelope: true,
      errors: [400, 401, 403, 404, 409, 422, 429, 503],
    });
    app.route({
      method,
      url,
      handler: async (request, reply) => {
        const actor = await authenticateVerified(authenticate, request.headers.authorization);
        const params = (request.params ?? {}) as Record<string, string>;
        for (const value of Object.values(params)) schemas.idSchema.parse(value);
        const context = {
          userId: actor.id,
          params,
          query: (request.query ?? {}) as Record<string, string>,
          requestKey: request.headers['idempotency-key']
            ? schemas.idSchema.parse(request.headers['idempotency-key'])
            : uuidv7(),
          language: schemas.requestLanguage(request.headers['accept-language']),
        };
        const input = schema.parse(request.body ?? {});
        const data = await db.run(actor.id, (tx) => handle(context, tx, input));
        return reply.code(status).send(status === 204 ? undefined : { data });
      },
    });
  }
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
  if (env.AI_SEARCH_ENABLED) {
    route(
      'POST',
      '/v1/portfolio-images/:id/index',
      empty,
      async (c, tx) => {
        ai.ready();
        const image = await tx.one<{ portfolioId: string }>(
          'select portfolio_id from portfolio_images where id=$1',
          [c.params.id],
        );
        await requirePortfolioOwnership(tx, c.userId, image.portfolioId);
        return enqueueIndex(tx, c.userId, c.params.id, env, uuidv7());
      },
      { status: 202 },
    );
  }
  route('GET', '/v1/creative-projects/:id/messages', empty, async (c, tx) => {
    await project(tx, c.params.id);
    return tx.rows(
      'select id,role,content,created_at from ai_messages where project_id=$1 order by created_at,id',
      [c.params.id],
    );
  });
  route('GET', '/v1/creative-projects/:id/actions', empty, async (c, tx) => {
    await project(tx, c.params.id);
    return tx.rows(
      'select * from ai_actions where project_id=$1 and proposed_for=$2 order by created_at desc',
      [c.params.id, c.userId],
    );
  });
  route(
    'POST',
    '/v1/ai-actions/:id/confirm',
    empty,
    (c, tx) => confirmAction(tx, c.userId, c.params.id),
    { status: 200 },
  );
  route(
    'POST',
    '/v1/ai-actions/:id/reject',
    empty,
    async (c, tx) => {
      const a = await tx.one<{ projectId: string }>(
        'select project_id from ai_actions where id=$1 and proposed_for=$2',
        [c.params.id, c.userId],
      );
      await project(tx, a.projectId);
      return tx.one(
        "update ai_actions set status='rejected' where id=$1 and status='proposed' returning *",
        [c.params.id],
      );
    },
    { status: 200 },
  );
  route('GET', '/v1/creative-projects/:id/ai-jobs', empty, async (c, tx) => {
    await project(tx, c.params.id);
    return tx.rows(
      'select * from ai_jobs where project_id=$1 and user_id=$2 order by created_at desc limit 50',
      [c.params.id, c.userId],
    );
  });
  route(
    'POST',
    '/v1/creative-projects/:id/ai-jobs',
    schemas.jobInputSchema,
    async (c, tx, i) => {
      ai.ready();
      return enqueue(tx, c.userId, c.params.id, i, c.requestKey, c.language);
    },
    { status: 202 },
  );
  route('GET', '/v1/ai-jobs/:id', empty, async (c, tx) => {
    const j = await tx.one<{ projectId: string | null }>(
      'select * from ai_jobs where id=$1 and user_id=$2',
      [c.params.id, c.userId],
    );
    if (j.projectId) await project(tx, j.projectId);
    return j;
  });
  route('GET', '/v1/me/ai-usage', empty, (c, tx) =>
    tx.one(
      "select count(*)::int as requests,coalesce(sum(greatest(reserved_usd,coalesce(actual_usd,0))),0)::float as reserved_usd,coalesce(sum(image_count),0)::int as images from ai_usage where user_id=$1 and created_at>=date_trunc('month',now()) and status<>'released'",
      [c.userId],
    ),
  );

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
  route('GET', '/v1/me/notifications', empty, (c, tx) =>
    tx.rows(
      'select * from notifications where recipient_id=$1 order by created_at desc,id desc limit 100',
      [c.userId],
    ),
  );
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
  route('PATCH', '/v1/bookings/:id/schedule', schemas.scheduleInputSchema, (c, tx, i) =>
    bookings.reschedule(tx, c.params.id, i),
  );
  route('GET', '/v1/bookings/:id/workspace', empty, async (c, tx) => {
    const result = await bookings.workspace(tx, c.params.id, c.userId);
    result.images = await Promise.all(
      result.images.map(async (i) => {
        const image = i as { storagePath: string };
        return { ...(i as object), url: await media.url('gallery-previews', image.storagePath) };
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

  // AI network calls are outside DB transactions; persisted reservations serialize spend.
  if (env.AI_SEARCH_ENABLED) {
    app.post('/v1/search', async (request) => {
      const actor = await authenticateVerified(authenticate, request.headers.authorization);
      return search(
        db,
        ai,
        actor.id,
        schemas.searchInputSchema.parse(request.body),
        schemas.requestLanguage(request.headers['accept-language']),
      );
    });
  }
  app.post('/v1/creative-projects/:id/assistant', async (request) => {
    const actor = await authenticateVerified(authenticate, request.headers.authorization);
    const id = schemas.idSchema.parse((request.params as { id: string }).id);
    const input = schemas.assistantInputSchema.parse(request.body);
    const language = schemas.requestLanguage(request.headers['accept-language']);
    if (input.mode === 'brief') return { data: await ai.plan(actor.id, id, input.text, language) };
    if (input.mode === 'action')
      return { data: await ai.proposeAction(actor.id, id, input.text, language) };
    throw new ApiError(400, 'VALIDATION_ERROR', 'use_streaming_chat');
  });
  app.post('/v1/creative-projects/:id/chat', async (request, reply) => {
    const actor = await authenticateVerified(authenticate, request.headers.authorization);
    const id = schemas.idSchema.parse((request.params as { id: string }).id);
    const body = z
      .object({
        messages: z
          .array(
            z.object({
              role: z.string(),
              parts: z.array(z.object({ type: z.string(), text: z.string().optional() })),
            }),
          )
          .max(100),
      })
      .parse(request.body);
    const last = body.messages.at(-1);
    requireCondition(last?.role === 'user', 400, 'user_message_required');
    const text = z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .parse(
        last.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
          .join('\n'),
      );
    const language = schemas.requestLanguage(request.headers['accept-language']);
    const stream = await ai.chat(actor.id, id, text, language);
    return reply.send(
      createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: stream.stream,
          sendReasoning: false,
          onError: () => aiStreamError(language),
        }),
      }),
    );
  });
}
