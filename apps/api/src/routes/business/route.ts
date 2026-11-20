import type { FastifyInstance } from 'fastify';
import type { ApiDependencies } from '../../plugins/route.js';
import { AiService } from '../../services/ai.js';
import { MediaService } from '../../services/media.js';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import * as schemas from '@frameroom/shared';
import type { Transaction } from '../../repositories/database.js';
import { authenticateVerified } from '../../lib/auth.js';
import type { RouteMethod } from '../../plugins/route.js';

type Context = {
  userId: string;
  params: Record<string, string>;
  query: Record<string, string>;
  requestKey: string;
  language: schemas.Language;
};

export const empty = z.object({});
export function createBusinessContext(app: FastifyInstance, deps: ApiDependencies) {
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
      response:
        method === 'GET' && url === '/v1/bookings/:id/workspace'
          ? schemas.bookingWorkspaceSchema
          : method === 'GET' && url === '/v1/bookings'
            ? z.array(schemas.bookingSchema)
            : method === 'GET' && url === '/v1/bookings/:id'
              ? schemas.bookingSchema
              : method === 'GET' && url === '/v1/me/notifications'
                ? z.array(schemas.notificationSchema)
                : z.unknown(),
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
  return { route, db, authenticate, env, media, ai, app };
}
export type BusinessContext = ReturnType<typeof createBusinessContext>;
