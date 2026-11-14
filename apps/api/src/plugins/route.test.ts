import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';
import { defineRoute, Respond, type ApiModule } from './route.js';

const calls: Array<string | null> = [];
const database: Database = {
  isConfigured: true,
  async run(userId, action) {
    calls.push(userId);
    return action({} as Transaction);
  },
  async close() {},
};

const noteInput = z.object({ title: z.string().min(1) });
const noteOutput = z.object({ id: z.string(), title: z.string() });

const testModule: ApiModule = {
  name: 'test',
  register(app, deps) {
    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/notes/:id',
      summary: 'Delete note',
      access: 'verified',
      params: z.object({ id: z.string().uuid() }),
      status: 204,
      envelope: false,
      response: z.undefined(),
      handler: async () => undefined,
    });
    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/notes',
      summary: 'Create note',
      access: 'verified',
      body: noteInput,
      response: noteOutput,
      handler: async ({ actor, body, transaction }) =>
        transaction(async () => ({ id: actor.id, title: body.title, secret: 'must-not-leak' })),
    });
    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/notes/retry',
      summary: 'Idempotent create',
      access: 'verified',
      body: noteInput,
      response: noteOutput,
      successStatuses: [200],
      handler: async ({ actor, body }) => new Respond(200, { id: actor.id, title: body.title }),
    });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/notes/:id',
      summary: 'Read note',
      access: 'public',
      params: z.object({ id: z.string().uuid() }),
      response: noteOutput,
      handler: async ({ params }) => {
        if (params.id.startsWith('00000000')) throw new ApiError(404, 'NOT_FOUND', 'not_found');
        return { id: params.id, title: 'note' };
      },
    });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/notes-bad',
      summary: 'Violates its own contract',
      access: 'public',
      response: noteOutput,
      handler: async () => ({ id: 1 }) as unknown as z.input<typeof noteOutput>,
    });
    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/notes/:id',
      summary: 'Delete note',
      access: 'public',
      status: 204,
      params: z.object({ id: z.string() }),
      response: z.void(),
      handler: async () => undefined,
    });
  },
};

const apps: ReturnType<typeof buildApp>[] = [];
function createApp(verified = true) {
  const app = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }), {
    db: database,
    modules: [testModule],
    authenticate: async (header) => {
      if (header !== 'Bearer good') throw new ApiError(401, 'UNAUTHORIZED', 'invalid_session');
      return { id: 'user-1', isVerified: verified };
    },
  });
  apps.push(app);
  return app;
}
afterEach(async () => {
  calls.length = 0;
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const auth = { authorization: 'Bearer good' };

describe('defineRoute', () => {
  it('wraps data, uses the default 201 and strips fields outside the response schema', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/v1/notes',
      headers: auth,
      payload: { title: 'hello' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ data: { id: 'user-1', title: 'hello' } });
    expect(calls).toEqual(['user-1']);
  });

  it('lets a handler override the status', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/v1/notes/retry',
      headers: auth,
      payload: { title: 'again' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('ignores unknown body keys and never lets them forge the actor', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/v1/notes',
      headers: auth,
      payload: { title: 'x', id: 'someone-else', roles: ['system_admin'] },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ data: { id: 'user-1', title: 'x' } });
    expect(calls).toEqual(['user-1']);
  });

  it('reports invalid fields with a 400 and per-field details', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/v1/notes',
      headers: auth,
      payload: { title: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.details[0]).toMatchObject({ field: 'title', reason: 'too_small' });
  });

  it('requires a bearer token and never opens a transaction without one', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/v1/notes',
      payload: { title: 'x' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.details).toEqual([{ reason: 'invalid_session' }]);
    expect(calls).toEqual([]);
  });

  it('returns 403 for an unverified email', async () => {
    const response = await createApp(false).inject({
      method: 'POST',
      url: '/v1/notes',
      headers: auth,
      payload: { title: 'x' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.details).toEqual([{ reason: 'email_confirmation_required' }]);
  });

  it('validates path params and maps handler errors', async () => {
    const app = createApp();
    const invalid = await app.inject({ url: '/v1/notes/not-a-uuid' });
    expect(invalid.statusCode).toBe(400);
    const missing = await app.inject({ url: '/v1/notes/00000000-0000-4000-8000-000000000000' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
  });

  it('turns a response contract violation into a generic 500', async () => {
    const response = await createApp().inject({ url: '/v1/notes-bad' });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.message).toBe('Unexpected server error');
  });

  it('answers unknown routes with the error envelope', async () => {
    const response = await createApp().inject({ url: '/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.details).toEqual([{ reason: 'route_not_found' }]);
  });

  it('answers malformed JSON with a 400 envelope', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/v1/notes',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: '{bad',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
  it('emits an empty body when status is 204', async () => {
    const response = await createApp().inject({ method: 'DELETE', url: '/v1/notes/123' });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });
});

describe('OpenAPI document', () => {
  it('is generated from the registered schemas', async () => {
    const response = await createApp().inject({ url: '/v1/openapi.json' });
    const document = response.json();
    expect(document.openapi).toBe('3.0.3');
    expect(document.components.securitySchemes.bearerAuth).toBeDefined();

    const create = document.paths['/v1/notes'].post;
    expect(create.security).toEqual([{ bearerAuth: [] }]);
    expect(create.requestBody.content['application/json'].schema.properties.title).toBeDefined();
    expect(Object.keys(create.responses)).toEqual(
      expect.arrayContaining(['201', '400', '401', '403']),
    );

    const read = document.paths['/v1/notes/{id}'].get;
    expect(read.security).toEqual([]);
    expect(read.parameters[0]).toMatchObject({ in: 'path', name: 'id', required: true });
  });

  it('documents profile response envelopes and both create/retry success codes', async () => {
    const response = await createApp().inject({ url: '/v1/openapi.json' });
    const paths = response.json().paths;
    for (const path of ['/v1/me', '/v1/photographers/me']) {
      for (const method of ['get', 'post', 'patch']) {
        const status = method === 'post' ? '201' : '200';
        const schema = paths[path][method].responses[status].content['application/json'].schema;
        expect(schema.properties.data).toBeDefined();
        expect(schema.required).toContain('data');
      }
    }
    expect(paths['/v1/me'].post.responses['200']).toBeDefined();
    expect(paths['/v1/me'].get.responses['404']).toBeDefined();
    expect(paths['/v1/notes/{id}'].delete.responses['204']).toEqual({ description: 'Success' });
  });
});
