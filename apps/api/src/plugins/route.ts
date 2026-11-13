import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import type { ApiEnv } from '../config/env.js';
import { authenticateVerified, type Authenticate, type Identity } from '../lib/auth.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';
import type { OpenApiRegistry } from './openapi.js';

export type RouteMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Access = 'public' | 'verified';
type SchemaOption = z.ZodTypeAny | undefined;
type Parsed<S extends SchemaOption> = S extends z.ZodTypeAny ? z.output<S> : undefined;

/** Everything a module needs to register routes. Modules do not construct these. */
export interface ApiDependencies {
  env: ApiEnv;
  db: Database;
  authenticate: Authenticate;
  openApi: OpenApiRegistry;
}

/** One feature area (profiles, catalog, booking...) registers itself through this. */
export interface ApiModule {
  name: string;
  register(app: FastifyInstance, deps: ApiDependencies): void;
}

/** Return from a handler to override the route's default status code. */
export class Respond<T> {
  constructor(
    readonly status: number,
    readonly data: T,
  ) {}
}

export interface RouteContext<A extends Access, P, Q, B> {
  actor: A extends 'verified' ? Identity : null;
  params: P;
  query: Q;
  body: B;
  /** Runs SQL in one transaction scoped to the actor. */
  transaction<T>(action: (tx: Transaction) => Promise<T>): Promise<T>;
}

export interface RouteSpec<
  A extends Access,
  P extends SchemaOption,
  Q extends SchemaOption,
  B extends SchemaOption,
  R extends z.ZodTypeAny,
> {
  method: RouteMethod;
  url: string;
  summary: string;
  access: A;
  params?: P;
  query?: Q;
  body?: B;
  /** Success payload. Handler results are parsed with it, which also strips extra fields. */
  response: R;
  /** Default success status. 201 for creates, 202 for queued jobs. */
  status?: number;
  /** False only for unenveloped responses such as GET /health. */
  envelope?: boolean;
  /** Extra error statuses to document beyond those implied by the spec. */
  errors?: number[];
  handler(
    context: RouteContext<A, Parsed<P>, Parsed<Q>, Parsed<B>>,
  ): Promise<z.input<R> | Respond<z.input<R>>>;
}

function defaultStatus(method: RouteMethod) {
  return method === 'POST' ? 201 : 200;
}

function documentedErrors(spec: {
  access: Access;
  params?: SchemaOption;
  query?: SchemaOption;
  body?: SchemaOption;
  errors?: number[];
}) {
  const statuses = [...(spec.errors ?? [])];
  if (spec.params || spec.query || spec.body) statuses.push(400);
  if (spec.access === 'verified') statuses.push(401, 403);
  if (spec.params) statuses.push(404);
  return statuses;
}

/**
 * Registers a Fastify route and its OpenAPI operation from the same Zod schemas, so the
 * published contract cannot drift from the validation actually applied.
 */
export function defineRoute<
  A extends Access,
  P extends SchemaOption = undefined,
  Q extends SchemaOption = undefined,
  B extends SchemaOption = undefined,
  R extends z.ZodTypeAny = z.ZodTypeAny,
>(app: FastifyInstance, deps: ApiDependencies, spec: RouteSpec<A, P, Q, B, R>) {
  const envelope = spec.envelope ?? true;
  const status = spec.status ?? defaultStatus(spec.method);
  deps.openApi.add({
    method: spec.method,
    url: spec.url,
    summary: spec.summary,
    isPublic: spec.access === 'public',
    status,
    params: spec.params,
    query: spec.query,
    body: spec.body,
    response: spec.response,
    envelope,
    errors: documentedErrors(spec),
  });

  app.route({
    method: spec.method,
    url: spec.url,
    handler: async (request, reply) => {
      const actor =
        spec.access === 'verified'
          ? await authenticateVerified(deps.authenticate, request.headers.authorization)
          : null;
      const params = spec.params ? spec.params.parse(request.params) : undefined;
      const query = spec.query ? spec.query.parse(request.query) : undefined;
      const body = spec.body ? spec.body.parse(request.body ?? {}) : undefined;
      const result = await spec.handler({
        actor: actor as RouteContext<A, never, never, never>['actor'],
        params: params as Parsed<P>,
        query: query as Parsed<Q>,
        body: body as Parsed<B>,
        transaction: (action) => deps.db.run(actor?.id ?? null, action),
      });
      const outcome = result instanceof Respond ? result : new Respond(status, result);
      const parsed = spec.response.safeParse(outcome.data);
      if (!parsed.success) {
        // Hợp đồng response bị vi phạm là lỗi của server: trả 500 chung, không lộ chi tiết.
        request.log.error({ issues: parsed.error.issues }, 'response contract violation');
        throw new ApiError(500, 'INTERNAL_ERROR', 'internal_error', 'Unexpected server error');
      }
      return reply.code(outcome.status).send(envelope ? { data: parsed.data } : parsed.data);
    },
  });
}
