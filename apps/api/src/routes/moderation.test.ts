import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const STUDIO_ID = '44444444-4444-4444-8444-444444444444';
const REPORT_ID = '55555555-5555-4555-8555-555555555555';
const TARGET_ID = '66666666-6666-4666-8666-666666666666';

type QueryResponse =
  | { kind: 'one'; value: unknown }
  | { kind: 'optional'; value: unknown }
  | { kind: 'rows'; value: unknown[] }
  | { kind: 'execute'; value?: number }
  | { kind: 'throw'; error: unknown };

const queue: QueryResponse[] = [];
const executedSql: Array<{ sql: string; params?: unknown[] }> = [];

function nextResponse(kind: string, sql: string, params?: unknown[]) {
  executedSql.push({ sql, params });
  const item = queue.shift();
  if (!item) {
    throw new Error(`Unexpected ${kind} query with empty mock queue: ${sql}`);
  }
  if (item.kind === 'throw') {
    throw item.error;
  }
  if (item.kind !== kind) {
    throw new Error(`Expected query kind ${item.kind} but got ${kind} for SQL: ${sql}`);
  }
  return item.value;
}

const mockTx = {
  one: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('one', sql, params)),
  optional: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('optional', sql, params)),
  rows: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('rows', sql, params)),
  execute: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('execute', sql, params)),
} as unknown as Transaction;

const mockDb: Database = {
  isConfigured: true,
  async run(_userId, action) {
    return action(mockTx);
  },
  async close() {},
};

const apps: ReturnType<typeof buildApp>[] = [];

function createTestApp() {
  const app = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }), {
    db: mockDb,
    authenticate: async (header) => {
      if (header === 'Bearer user') return { id: USER_ID, isVerified: true };
      if (header === 'Bearer manager') return { id: MANAGER_ID, isVerified: true };
      if (header === 'Bearer admin') return { id: ADMIN_ID, isVerified: true };
      throw new ApiError(401, 'UNAUTHORIZED', 'invalid_session');
    },
  });
  apps.push(app);
  return app;
}

beforeEach(() => {
  queue.length = 0;
  executedSql.length = 0;
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('studio dashboard (108a)', () => {
  it('returns studio stats, upcoming bookings, and active resources for a studio manager', async () => {
    const app = createTestApp();

    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { bookings: 12, completed: 9, completedValue: 18500000 } },
      {
        kind: 'rows',
        value: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            studioId: STUDIO_ID,
            status: 'confirmed',
          },
        ],
      },
      {
        kind: 'rows',
        value: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            studioId: STUDIO_ID,
            name: 'Cyclorama Stage A',
            type: 'room',
          },
        ],
      },
    );

    const res = await app.inject({
      method: 'GET',
      url: `/v1/studios/${STUDIO_ID}/dashboard`,
      headers: { authorization: 'Bearer manager' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({
      stats: { bookings: 12, completed: 9, completedValue: 18500000 },
      upcoming: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          studioId: STUDIO_ID,
          status: 'confirmed',
        },
      ],
      resources: [
        {
          id: '88888888-8888-4888-8888-888888888888',
          studioId: STUDIO_ID,
          name: 'Cyclorama Stage A',
          type: 'room',
        },
      ],
    });
  });

  it('rejects non-managers from accessing studio dashboard (403 forbidden)', async () => {
    const app = createTestApp();

    queue.push({ kind: 'one', value: { allowed: false } });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/studios/${STUDIO_ID}/dashboard`,
      headers: { authorization: 'Bearer user' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.details).toEqual([{ reason: 'forbidden' }]);
  });
});

describe('content reports and admin moderation (108b)', () => {
  it('allows any verified user to submit a content report and validates target/reason', async () => {
    const app = createTestApp();

    queue.push({
      kind: 'one',
      value: {
        id: REPORT_ID,
        reporterId: USER_ID,
        targetType: 'portfolio_image',
        targetId: TARGET_ID,
        reason: 'copyright',
        description: 'Uncredited commercial image',
        status: 'open',
      },
    });

    const okRes = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: 'Bearer user' },
      payload: {
        targetType: 'portfolio_image',
        targetId: TARGET_ID,
        reason: 'copyright',
        description: 'Uncredited commercial image',
      },
    });
    expect(okRes.statusCode).toBe(201);
    expect(okRes.json().data.id).toBe(REPORT_ID);
    expect(okRes.json().data.status).toBe('open');

    const badRes = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: 'Bearer user' },
      payload: {
        targetType: 'unknown_entity',
        targetId: TARGET_ID,
        reason: 'spam',
        description: 'Invalid target',
      },
    });
    expect(badRes.statusCode).toBe(400);
  });

  it('blocks non-admin callers from admin report and moderation routes (403 forbidden)', async () => {
    const app = createTestApp();

    queue.push({ kind: 'one', value: { allowed: false } });
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/reports',
      headers: { authorization: 'Bearer user' },
    });
    expect(listRes.statusCode).toBe(403);

    queue.push({ kind: 'one', value: { allowed: false } });
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/reports/${REPORT_ID}`,
      headers: { authorization: 'Bearer user' },
      payload: { status: 'resolved' },
    });
    expect(patchRes.statusCode).toBe(403);

    queue.push({ kind: 'one', value: { allowed: false } });
    const modRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation',
      headers: { authorization: 'Bearer user' },
      payload: { targetType: 'review', targetId: TARGET_ID, isHidden: true },
    });
    expect(modRes.statusCode).toBe(403);
  });

  it('lists and resolves reports for admins', async () => {
    const app = createTestApp();

    queue.push(
      { kind: 'one', value: { allowed: true } },
      {
        kind: 'rows',
        value: [
          {
            id: REPORT_ID,
            targetType: 'review',
            targetId: TARGET_ID,
            reason: 'spam',
            status: 'open',
          },
        ],
      },
    );

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/reports',
      headers: { authorization: 'Bearer admin' },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data).toHaveLength(1);

    queue.push(
      { kind: 'one', value: { allowed: true } },
      {
        kind: 'one',
        value: {
          id: REPORT_ID,
          status: 'resolved',
        },
      },
    );

    const resolveRes = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/reports/${REPORT_ID}`,
      headers: { authorization: 'Bearer admin' },
      payload: { status: 'resolved' },
    });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json().data.status).toBe('resolved');
  });

  it('hides and unhides portfolios via status and other target entities via is_hidden', async () => {
    const app = createTestApp();

    // Hiding a portfolio sets status = 'hidden'
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: TARGET_ID, status: 'hidden' } },
    );
    const hidePortfolioRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation',
      headers: { authorization: 'Bearer admin' },
      payload: { targetType: 'portfolio', targetId: TARGET_ID, isHidden: true },
    });
    expect(hidePortfolioRes.statusCode).toBe(201);
    expect(hidePortfolioRes.json().data.status).toBe('hidden');
    expect(executedSql.at(-1)?.params).toEqual([TARGET_ID, 'hidden']);

    // Unhiding a portfolio restores status = 'draft'
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: TARGET_ID, status: 'draft' } },
    );
    const unhidePortfolioRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation',
      headers: { authorization: 'Bearer admin' },
      payload: { targetType: 'portfolio', targetId: TARGET_ID, isHidden: false },
    });
    expect(unhidePortfolioRes.statusCode).toBe(201);
    expect(unhidePortfolioRes.json().data.status).toBe('draft');
    expect(executedSql.at(-1)?.params).toEqual([TARGET_ID, 'draft']);

    // Hiding a review/photographer/message updates is_hidden = true
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: TARGET_ID } },
    );
    const hideReviewRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/moderation',
      headers: { authorization: 'Bearer admin' },
      payload: { targetType: 'review', targetId: TARGET_ID, isHidden: true },
    });
    expect(hideReviewRes.statusCode).toBe(201);
    expect(executedSql.at(-1)?.sql).toContain('update reviews set is_hidden=$2');
    expect(executedSql.at(-1)?.params).toEqual([TARGET_ID, true]);
  });
});

describe('enhanced validation and edge cases (108c)', () => {
  it('rejects report with missing required fields or empty description (400)', async () => {
    const app = createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: 'Bearer user' },
      payload: { targetId: TARGET_ID, reason: 'spam', description: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate report with 409 already_exists', async () => {
    const app = createTestApp();
    queue.push({ kind: 'throw', error: { code: '23505', constraint: 'reports_pkey' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: 'Bearer user' },
      payload: {
        targetType: 'portfolio_image',
        targetId: TARGET_ID,
        reason: 'spam',
        description: 'Duplicate spam report',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details).toEqual([{ reason: 'already_exists' }]);
  });

  it('returns 404 when admin updates a non-existent report id', async () => {
    const app = createTestApp();
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'throw', error: new ApiError(404, 'NOT_FOUND', 'not_found') },
    );
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/reports/${REPORT_ID}`,
      headers: { authorization: 'Bearer admin' },
      payload: { status: 'resolved' },
    });
    expect(res.statusCode).toBe(404);
  });
});
