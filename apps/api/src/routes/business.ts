import type { FastifyInstance, HTTPMethods } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { v7 as uuidv7 } from 'uuid';
import * as schemas from '@frameroom/shared';
import type { ApiEnv } from '../config/env.js';
import { Database, Transaction } from '../repositories/database.js';
import { type Authenticate, type Identity } from '../lib/auth.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import * as profiles from '../services/providers.js';
import * as catalog from '../services/catalog.js';
import * as projects from '../services/projects.js';
import * as bookings from '../services/bookings.js';
import * as room from '../services/collaboration.js';
import { admin, booking, manager, project, providerSide } from '../services/access.js';
import { MediaService, uploadBuckets } from '../services/media.js';
import { AiService } from '../services/ai.js';
import { enqueue, enqueueIndex } from '../services/ai-jobs.js';
import { confirmAction } from '../services/ai-actions.js';
import { search } from '../services/search.js';
import { aiStreamError } from '../services/ai-language.js';

type Context = {
  userId: string;
  params: Record<string, string>;
  query: Record<string, string>;
  identity: Identity | null;
  requestKey: string;
  language: schemas.Language;
};
type Dependencies = {
  db: Database;
  authenticate: Authenticate;
  media: MediaService;
  ai: AiService;
  env: ApiEnv;
};
const empty = z.object({});
export function registerBusiness(app: FastifyInstance, deps: Dependencies) {
  const paths: Record<string, Record<string, unknown>> = {};
  const { db, authenticate, media, ai, env } = deps;
  async function identity(header: string | undefined, isPublic = false) {
    if (!header && isPublic) return null;
    const actor = await authenticate(header);
    requireCondition(actor.isVerified, 403, 'email_confirmation_required');
    return actor;
  }
  function route<T extends z.ZodTypeAny>(
    method: HTTPMethods,
    url: string,
    schema: T,
    handle: (ctx: Context, tx: Transaction, input: z.infer<T>) => Promise<unknown>,
    options: { public?: boolean; status?: number } = {},
  ) {
    const key = url.replace(/:([a-zA-Z]+)/g, '{$1}');
    paths[key] ??= {};
    paths[key][method.toLowerCase()] = {
      summary: `${method} ${url}`,
      security: options.public ? [] : [{ bearerAuth: [] }],
      ...(method === 'GET' || method === 'DELETE'
        ? {}
        : {
            requestBody: {
              content: {
                'application/json': { schema: zodToJsonSchema(schema, { target: 'openApi3' }) },
              },
            },
          }),
      parameters: [...url.matchAll(/:([a-zA-Z]+)/g)].map((m) => ({
        in: 'path',
        name: m[1],
        required: true,
        schema: { type: 'string', format: 'uuid' },
      })),
      responses: {
        [options.status ?? (method === 'POST' ? 201 : 200)]: { description: 'Success' },
        400: { description: 'Validation error' },
        401: { description: 'Authentication required' },
        403: { description: 'Access denied' },
        409: { description: 'Conflict' },
        422: { description: 'Invalid state' },
        503: { description: 'Service unavailable' },
      },
    };
    app.route({
      method,
      url,
      handler: async (request, reply) => {
        const actor = await identity(request.headers.authorization, options.public);
        const params = (request.params ?? {}) as Record<string, string>;
        for (const value of Object.values(params)) schemas.idSchema.parse(value);
        const context = {
          userId: actor?.id ?? '',
          identity: actor,
          params,
          query: (request.query ?? {}) as Record<string, string>,
          requestKey: request.headers['idempotency-key']
            ? schemas.idSchema.parse(request.headers['idempotency-key'])
            : uuidv7(),
          language: schemas.requestLanguage(request.headers['accept-language']),
        };
        const input = schema.parse(request.body ?? {});
        const data = await db.run(actor?.id ?? null, (tx) => handle(context, tx, input));
        const status = options.status ?? (method === 'POST' ? 201 : 200);
        return reply.code(status).send(status === 204 ? undefined : { data });
      },
    });
  }
  app.get('/v1/config', async () => ({
    data: {
      authConfigured: Boolean(env.SUPABASE_ANON_KEY),
      databaseConfigured: Boolean(env.DATABASE_URL),
      storageConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      aiConfigured: Boolean(env.AI_GATEWAY_API_KEY),
      monthlyBudgetUsd: env.AI_MONTHLY_BUDGET_USD,
    },
  }));
  app.get('/v1/openapi.json', async () => ({
    openapi: '3.0.3',
    info: { title: 'FrameRoom MVP API', version: '1.0.0' },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: { Error: zodToJsonSchema(schemas.errorSchema, { target: 'openApi3' }) },
    },
    paths,
  }));

  route('GET', '/v1/me', empty, (c, tx) => profiles.getProfile(tx, c.userId));
  app.post('/v1/me', async (request, reply) => {
    const actor = await identity(request.headers.authorization);
    const input = schemas.profileInputSchema.parse(request.body);
    const result = await db.run(actor!.id, (tx) => profiles.createProfile(tx, actor!.id, input));
    return reply.code(result.created ? 201 : 200).send({ data: result.data });
  });
  route('PATCH', '/v1/me', schemas.profileInputSchema, async (c, tx, i) => {
    await tx.one('update profiles set user_name=$2,display_name=$3 where id=$1 returning id', [
      c.userId,
      i.userName,
      i.displayName,
    ]);
    return profiles.getProfile(tx, c.userId);
  });
  route('GET', '/v1/me/studios', empty, (c, tx) =>
    tx.rows(
      'select s.*,m.role from studios s join studio_members m on m.studio_id=s.id where m.user_id=$1 and s.deleted_at is null order by s.name',
      [c.userId],
    ),
  );
  route('GET', '/v1/me/invitations', empty, (c, tx) =>
    tx.rows(
      'select i.*,s.name as studio_name from studio_invitations i join studios s on s.id=i.studio_id join photographers p on p.id=i.photographer_id where p.user_id=$1 and s.deleted_at is null order by i.created_at desc',
      [c.userId],
    ),
  );
  route('GET', '/v1/photographers/me', empty, (c, tx) =>
    tx.optional('select * from photographers where user_id=$1', [c.userId]).then((v) => v ?? null),
  );
  route('POST', '/v1/photographers/me', schemas.photographerInputSchema, (c, tx, i) =>
    profiles.createPhotographer(tx, c.userId, i),
  );
  route('PATCH', '/v1/photographers/me', schemas.photographerInputSchema, (c, tx, i) =>
    tx.one(
      'update photographers set display_name=$2,bio=$3,city=$4,district=$5,genres=$6,styles=$7 where user_id=$1 returning *',
      [c.userId, i.displayName, i.bio, i.city, i.district, i.genres, i.styles],
    ),
  );
  route(
    'GET',
    '/v1/explore',
    empty,
    async (c, tx) => {
      const query = z
        .object({
          genre: schemas.genreSchema.optional(),
          city: z.string().max(100).optional(),
          district: z.string().max(100).optional(),
          priceMax: z.coerce.number().int().min(0).optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(c.query);
      const providers = await catalog.discover(
        tx,
        query,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      );
      return Promise.all(
        providers.map(async (p) => ({
          ...p,
          coverUrl: await tx
            .optional<{ storagePath: string }>(
              "select i.storage_path from portfolio_images i join portfolios po on po.id=i.portfolio_id where coalesce(po.photographer_id,po.studio_id)=$1 and po.status='published' and po.deleted_at is null and not i.is_hidden order by i.sort_order limit 1",
              [p.id],
            )
            .then((i) => (i ? media.url('portfolio-images', i.storagePath, true) : null)),
        })),
      );
    },
    { public: true },
  );
  for (const [plural, type] of [
    ['photographers', 'photographer'],
    ['studios', 'studio'],
  ] as const) {
    route(
      'GET',
      `/v1/${plural}`,
      empty,
      (_c, tx) =>
        tx.rows('select * from providers where type=$1 order by display_name limit 50', [type]),
      { public: true },
    );
    route(
      'GET',
      `/v1/${plural}/:id`,
      empty,
      async (c, tx) => {
        const provider = await tx.one('select * from providers where id=$1 and type=$2', [
          c.params.id,
          type,
        ]);
        const services = await tx.rows(
          'select * from services where ' +
            (type === 'studio' ? 'studio_id' : 'photographer_id') +
            '=$1 and is_active and deleted_at is null order by price',
          [c.params.id],
        );
        const portfolios = await tx.rows<{ id: string; coverUrl?: string | null }>(
          `select * from portfolios where ${type === 'studio' ? 'studio_id' : 'photographer_id'}=$1 and status='published' and deleted_at is null`,
          [c.params.id],
        );
        for (const p of portfolios) {
          const image = await tx.optional<{ storagePath: string }>(
            'select storage_path from portfolio_images where portfolio_id=$1 and not is_hidden order by sort_order limit 1',
            [p.id],
          );
          p.coverUrl = image ? await media.url('portfolio-images', image.storagePath, true) : null;
        }
        return {
          provider,
          services,
          portfolios,
          reviews: await tx.rows(
            `select r.*,p.display_name as author_name from reviews r join profiles p on p.id=r.author_id where ${type === 'studio' ? 'studio_id' : 'photographer_id'}=$1 and not is_hidden and deleted_at is null order by r.created_at desc limit 50`,
            [c.params.id],
          ),
        };
      },
      { public: true },
    );
  }
  route('POST', '/v1/studios', schemas.studioInputSchema, (c, tx, i) =>
    profiles.createStudio(tx, c.userId, i),
  );
  route('PATCH', '/v1/studios/:id', schemas.studioInputSchema, async (c, tx, i) => {
    await manager(tx, c.params.id);
    return tx.one(
      'update studios set name=$2,description=$3,city=$4,district=$5,address=$6,genres=$7 where id=$1 returning *',
      [c.params.id, i.name, i.description, i.city, i.district, i.address, i.genres],
    );
  });
  route('GET', '/v1/studios/:id/team', empty, async (c, tx) => {
    await manager(tx, c.params.id);
    return tx.rows(
      'select m.*,p.display_name,p.user_name,ph.id as photographer_id from studio_members m join profiles p on p.id=m.user_id join photographers ph on ph.user_id=m.user_id where studio_id=$1',
      [c.params.id],
    );
  });
  route('POST', '/v1/studios/:id/invitations', schemas.invitationInputSchema, (c, tx, i) =>
    profiles.invite(tx, c.userId, c.params.id, i),
  );
  route('PATCH', '/v1/invitations/:id', schemas.invitationResponseSchema, (c, tx, i) =>
    profiles.respondInvitation(tx, c.userId, c.params.id, i.status),
  );
  route(
    'DELETE',
    '/v1/studios/:id/members/:userId',
    empty,
    (c, tx) => profiles.leaveStudio(tx, c.userId, c.params.id, c.params.userId),
    { status: 204 },
  );
  route(
    'PATCH',
    '/v1/studios/:id/members/:userId',
    z.object({ role: z.enum(['manager', 'photographer']) }),
    async (c, tx, i) => {
      await manager(tx, c.params.id);
      await tx.one('select id from studios where id=$1 for update', [c.params.id]);
      return tx.one(
        'update studio_members set role=$3 where studio_id=$1 and user_id=$2 returning *',
        [c.params.id, c.params.userId, i.role],
      );
    },
  );
  route('GET', '/v1/studios/:id/resources', empty, async (c, tx) => {
    await manager(tx, c.params.id);
    return tx.rows('select * from studio_resources where studio_id=$1 and deleted_at is null', [
      c.params.id,
    ]);
  });
  route('POST', '/v1/studios/:id/resources', schemas.resourceInputSchema, (c, tx, i) =>
    catalog.createResource(tx, c.params.id, i),
  );
  route('PATCH', '/v1/resources/:id', schemas.resourceInputSchema, async (c, tx, i) => {
    const r = await tx.one<{ studioId: string }>(
      'select * from studio_resources where id=$1 for update',
      [c.params.id],
    );
    await manager(tx, r.studioId);
    return tx.one(
      'update studio_resources set name=$2,type=$3,description=$4,is_active=$5 where id=$1 returning *',
      [c.params.id, i.name, i.type, i.description, i.isActive],
    );
  });
  route(
    'DELETE',
    '/v1/resources/:id',
    empty,
    async (c, tx) => {
      const r = await tx.one<{ studioId: string }>(
        'select * from studio_resources where id=$1 for update',
        [c.params.id],
      );
      await manager(tx, r.studioId);
      await tx.execute('update studio_resources set deleted_at=now(),is_active=false where id=$1', [
        c.params.id,
      ]);
    },
    { status: 204 },
  );
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
  route('GET', '/v1/me/services', empty, (c, tx) =>
    tx.rows(
      'select * from services where deleted_at is null and private.owns_provider(photographer_id,studio_id) order by name',
    ),
  );
  route('POST', '/v1/services', schemas.serviceInputSchema, (c, tx, i) =>
    catalog.createService(tx, c.userId, i),
  );
  route('POST', '/v1/studios/:id/services', schemas.serviceInputSchema, (c, tx, i) =>
    catalog.createService(tx, c.userId, i, c.params.id),
  );
  route('PATCH', '/v1/services/:id', schemas.serviceInputSchema, (c, tx, i) =>
    catalog.updateService(tx, c.params.id, i),
  );
  route(
    'DELETE',
    '/v1/services/:id',
    empty,
    async (c, tx) => {
      await catalog.ownedRecord(tx, 'services', c.params.id);
      await tx.execute('update services set deleted_at=now(),is_active=false where id=$1', [
        c.params.id,
      ]);
    },
    { status: 204 },
  );
  route(
    'GET',
    '/v1/services/:id/add-ons',
    empty,
    (c, tx) =>
      tx.rows(
        'select a.* from service_add_ons a join services s on s.id=a.service_id where a.service_id=$1 and a.deleted_at is null and a.is_active and s.deleted_at is null and private.provider_visible(s.photographer_id,s.studio_id)',
        [c.params.id],
      ),
    { public: true },
  );
  route('POST', '/v1/services/:id/add-ons', schemas.addOnInputSchema, (c, tx, i) =>
    catalog.createAddOn(tx, c.params.id, i),
  );
  route('GET', '/v1/tags', empty, (_c, tx) => tx.rows('select * from tags order by kind,name'), {
    public: true,
  });
  route('GET', '/v1/me/portfolios', empty, (_c, tx) =>
    tx.rows(
      'select * from portfolios where deleted_at is null and private.owns_provider(photographer_id,studio_id) order by created_at desc',
    ),
  );
  route(
    'GET',
    '/v1/portfolios',
    empty,
    (_c, tx) =>
      tx.rows(
        "select * from portfolios where status='published' and deleted_at is null and private.provider_visible(photographer_id,studio_id) order by published_at desc limit 50",
      ),
    { public: true },
  );
  route('POST', '/v1/portfolios', schemas.portfolioInputSchema, (c, tx, i) =>
    catalog.createPortfolio(tx, c.userId, i),
  );
  route('POST', '/v1/studios/:id/portfolios', schemas.portfolioInputSchema, (c, tx, i) =>
    catalog.createPortfolio(tx, c.userId, i, c.params.id),
  );
  route('PATCH', '/v1/portfolios/:id', schemas.portfolioInputSchema, (c, tx, i) =>
    catalog.updatePortfolio(tx, c.params.id, i),
  );
  route(
    'DELETE',
    '/v1/portfolios/:id',
    empty,
    async (c, tx) => {
      await catalog.ownedRecord(tx, 'portfolios', c.params.id);
      await tx.execute('update portfolios set deleted_at=now() where id=$1', [c.params.id]);
    },
    { status: 204 },
  );
  route(
    'GET',
    '/v1/portfolios/:id',
    empty,
    async (c, tx) => {
      const portfolio = await catalog.publicPortfolio(tx, c.params.id, c.userId);
      const images = await tx.rows<{ storagePath: string }>(
        'select * from portfolio_images where portfolio_id=$1 and not is_hidden order by sort_order',
        [c.params.id],
      );
      return {
        portfolio,
        images: await Promise.all(
          images.map(async (i) => ({
            ...i,
            url: await media.url('portfolio-images', i.storagePath, true),
          })),
        ),
      };
    },
    { public: true },
  );
  route(
    'POST',
    '/v1/portfolios/:id/images',
    schemas.portfolioImageInputSchema,
    async (c, tx, i) => {
      await catalog.ownedRecord(tx, 'portfolios', c.params.id);
      const file = await media.verify(
        'portfolio-images',
        i.storagePath,
        `${c.userId}/${c.params.id}`,
      );
      const image = await tx.one<{ id: string }>(
        'insert into portfolio_images(portfolio_id,storage_path,width,height,caption,provenance,source,collected_at,license_note,sort_order) values($1,$2,$3,$4,$5,$6,$7,case when $7::text is null then null else now() end,$8,(select count(*) from portfolio_images where portfolio_id=$1)) returning *',
        [
          c.params.id,
          i.storagePath,
          file.width,
          file.height,
          i.caption,
          i.provenance,
          i.source,
          i.licenseNote,
        ],
      );
      await enqueueIndex(tx, c.userId, image.id, env, uuidv7());
      return image;
    },
  );
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
      await catalog.ownedRecord(tx, 'portfolios', image.portfolioId);
      return enqueueIndex(tx, c.userId, c.params.id, env, uuidv7());
    },
    { status: 202 },
  );
  route(
    'PATCH',
    '/v1/portfolio-images/:id/tags',
    z.object({ tagIds: z.array(schemas.idSchema).max(20) }),
    async (c, tx, i) => {
      const image = await tx.one<{ portfolioId: string }>(
        'select portfolio_id from portfolio_images where id=$1',
        [c.params.id],
      );
      await catalog.ownedRecord(tx, 'portfolios', image.portfolioId);
      await tx.execute("delete from image_tags where portfolio_image_id=$1 and source='manual'", [
        c.params.id,
      ]);
      for (const id of i.tagIds)
        await tx.execute(
          "insert into image_tags(portfolio_image_id,tag_id,source) values($1,$2,'manual') on conflict(portfolio_image_id,tag_id) do update set source='manual',confidence=null",
          [c.params.id, id],
        );
      return i;
    },
  );

  route('GET', '/v1/creative-projects', empty, (_c, tx) =>
    tx.rows(
      'select p.*,b.id as booking_id from creative_projects p left join bookings b on b.project_id=p.id where private.can_read_project(p.id) order by p.updated_at desc',
    ),
  );
  route('POST', '/v1/creative-projects', schemas.projectInputSchema, (c, tx, i) =>
    projects.createProject(tx, c.userId, i),
  );
  route('GET', '/v1/creative-projects/:id', empty, (c, tx) => project(tx, c.params.id));
  route('PATCH', '/v1/creative-projects/:id', schemas.projectPatchSchema, async (c, tx, i) => {
    for (const path of i.referencePaths ?? [])
      await media.enforceReference(c.userId, 'brief-references', path);
    return projects.patchProject(tx, c.params.id, c.userId, i);
  });
  route('GET', '/v1/creative-projects/:id/references', empty, async (c, tx) => {
    const p = await project(tx, c.params.id);
    return Promise.all(
      p.referencePaths.map(async (path) => ({
        storagePath: path,
        url: await media.url('brief-references', path),
      })),
    );
  });
  route('GET', '/v1/creative-projects/:id/artifacts', empty, async (c, tx) => {
    await project(tx, c.params.id);
    const artifacts = await tx.rows<{ storagePath: string }>(
      'select * from ai_artifacts where project_id=$1 order by created_at desc',
      [c.params.id],
    );
    return Promise.all(
      artifacts.map(async (a) => ({ ...a, url: await media.url('ai-artifacts', a.storagePath) })),
    );
  });
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
  route('GET', '/v1/bookings/:id', empty, (c, tx) => booking(tx, c.params.id));
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
    result.messages = await Promise.all(
      result.messages.map(async (i) => {
        const m = i as { storagePath: string | null };
        return {
          ...(i as object),
          url: m.storagePath ? await media.url('room-files', m.storagePath) : null,
        };
      }),
    );
    return result;
  });
  route('POST', '/v1/bookings/:id/brief-versions', schemas.briefContentSchema, (c, tx, i) =>
    bookings.createBrief(tx, c.params.id, c.userId, i),
  );
  route(
    'POST',
    '/v1/bookings/:id/brief-versions/:briefId/approve',
    empty,
    (c, tx) => bookings.approveBrief(tx, c.params.id, c.params.briefId, c.userId),
    { status: 200 },
  );
  route('POST', '/v1/shoot-rooms/:id/messages', schemas.messageInputSchema, async (c, tx, i) => {
    if (i.storagePath) await media.verify('room-files', i.storagePath, c.params.id);
    return room.sendMessage(tx, c.userId, c.params.id, i);
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
      return tx.one('update room_milestones set status=$3 where id=$1 and room_id=$2 returning *', [
        c.params.milestoneId,
        c.params.id,
        i.status,
      ]);
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
      requireCondition(['confirmed', 'in_progress'].includes(b.status), 422, 'gallery_locked');
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
      const file = await media.verify('deliveries', i.storagePath, c.params.id, false);
      requireCondition(file.buffer.length <= 20971520, 400, 'file_too_large');
      return tx.one(
        'insert into deliveries(booking_id,storage_path,file_name,mime_type) values($1,$2,$3,$4) returning *',
        [c.params.id, i.storagePath, i.fileName, file.mimeType],
      );
    },
  );
  route('POST', '/v1/bookings/:id/reviews', schemas.reviewInputSchema, (c, tx, i) =>
    room.review(tx, c.userId, c.params.id, i),
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
        await catalog
          .owner(tx, c.userId)
          .then((o) => requireCondition(o.photographerId === e.photographerId));
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
    tx.one(
      'insert into content_reports(reporter_id,target_type,target_id,reason,description) values($1,$2,$3,$4,$5) returning *',
      [c.userId, i.targetType, i.targetId, i.reason, i.description],
    ),
  );
  route('GET', '/v1/admin/reports', empty, async (_c, tx) => {
    await admin(tx);
    return tx.rows('select * from content_reports order by created_at desc limit 100');
  });
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
  app.post('/v1/search', async (request) => {
    const actor = await identity(request.headers.authorization);
    return search(
      db,
      ai,
      actor!.id,
      schemas.searchInputSchema.parse(request.body),
      schemas.requestLanguage(request.headers['accept-language']),
    );
  });
  app.post('/v1/creative-projects/:id/assistant', async (request) => {
    const actor = await identity(request.headers.authorization);
    const id = schemas.idSchema.parse((request.params as { id: string }).id);
    const input = schemas.assistantInputSchema.parse(request.body);
    const language = schemas.requestLanguage(request.headers['accept-language']);
    if (input.mode === 'brief') return { data: await ai.plan(actor!.id, id, input.text, language) };
    if (input.mode === 'action')
      return { data: await ai.proposeAction(actor!.id, id, input.text, language) };
    throw new ApiError(400, 'VALIDATION_ERROR', 'use_streaming_chat');
  });
  app.post('/v1/creative-projects/:id/chat', async (request, reply) => {
    const actor = await identity(request.headers.authorization);
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
    const stream = await ai.chat(actor!.id, id, text, language);
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
  app.post('/v1/uploads', async (request, reply) => {
    const actor = await identity(request.headers.authorization);
    const query = z
      .object({ bucket: z.enum(uploadBuckets), scopeId: schemas.idSchema.optional() })
      .parse(request.query);
    const file = await request.file();
    if (!file) throw new ApiError(400, 'VALIDATION_ERROR', 'file_required');
    const buffer = await file.toBuffer();
    const data = await db.run(actor!.id, (tx) =>
      media.upload(tx, actor!.id, query.bucket, query.scopeId, buffer),
    );
    return reply.code(201).send({ data });
  });
}
