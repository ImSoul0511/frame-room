import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import type { Transaction, Database } from '../repositories/database.js';

const apps: ReturnType<typeof buildApp>[] = [];
function setup(verified = true) {
  const tx = {
    rows: vi.fn().mockResolvedValue([]),
    one: vi.fn(),
    optional: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const db: Database = {
    isConfigured: true,
    close: async () => {},
    run: vi.fn(async (_id, fn) => fn(tx as Transaction)),
  };
  const app = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }), {
    db,
    authenticate: async (header) => {
      if (!header) throw new ApiError(401, 'UNAUTHORIZED', 'authentication_required');
      return { id: 'client-id', isVerified: verified };
    },
  });
  apps.push(app);
  return { app, tx, db };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const headers = { authorization: 'Bearer synthetic' };
const id = '11111111-1111-4111-8111-111111111111';
describe('workflow tool access and request boundaries', () => {
  it('requires verified accounts on every new capability before touching the database', async () => {
    for (const verified of [true, false]) {
      const { app, db } = setup(verified);
      for (const [method, url, body] of [
        ['GET', '/v1/me/saved-providers', undefined],
        ['POST', '/v1/me/saved-providers', { providerType: 'studio', providerId: id }],
        ['DELETE', `/v1/me/saved-providers/${id}`, undefined],
        ['GET', '/v1/me/calendar?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z', undefined],
        ['PATCH', '/v1/me/notifications/read-all', {}],
        ['GET', '/v1/me/notifications?state=unread', undefined],
        ['GET', '/v1/me/notifications/counts', undefined],
        ['POST', `/v1/shoot-rooms/${id}/checklist`, {}],
      ] as const) {
        const response = await app.inject({
          method,
          url,
          headers: verified ? {} : headers,
          payload: body,
        });
        expect(response.statusCode).toBe(verified ? 401 : 403);
      }
      expect(db.run).not.toHaveBeenCalled();
    }
  });
  it('rejects reversed or excessive calendar ranges without a query', async () => {
    const { app, db } = setup();
    for (const query of [
      'from=2026-12-01T00:00:00Z&to=2026-11-01T00:00:00Z',
      'from=2026-01-01T00:00:00Z&to=2026-12-01T00:00:00Z',
    ])
      expect((await app.inject({ url: `/v1/me/calendar?${query}`, headers })).statusCode).toBe(400);
    expect(db.run).not.toHaveBeenCalled();
  });
  it('filters notifications before limiting and counts only the authenticated recipient', async () => {
    const { app, tx, db } = setup();
    expect(
      (await app.inject({ url: '/v1/me/notifications?state=forged', headers })).statusCode,
    ).toBe(400);
    expect(db.run).not.toHaveBeenCalled();
    expect(
      (await app.inject({ url: '/v1/me/notifications?state=unread&userId=forged', headers }))
        .statusCode,
    ).toBe(200);
    expect(tx.rows.mock.calls[0]?.[1]).toEqual(['client-id', 'unread']);
    tx.one.mockResolvedValueOnce({ unread: 101, total: 120 });
    const response = await app.inject({
      url: '/v1/me/notifications/counts?userId=forged',
      headers,
    });
    expect(response.json()).toEqual({ data: { unread: 101, total: 120 } });
    expect(tx.one.mock.calls[0]?.[1]).toEqual(['client-id']);
  });
  it('ignores forged owner input when saving and validates the target’s visibility', async () => {
    const { app, tx } = setup();
    tx.one.mockResolvedValueOnce({ visible: true }).mockResolvedValueOnce({
      id,
      providerType: 'studio',
      providerId: id,
      createdAt: '2026-11-20T00:00:00Z',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/saved-providers',
      headers,
      payload: { providerType: 'studio', providerId: id, userId: 'other-user' },
    });
    expect(response.statusCode).toBe(200);
    expect(tx.one.mock.calls[1]?.[1]).toEqual(['client-id', id]);
    tx.one.mockResolvedValueOnce({ visible: false });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/me/saved-providers',
          headers,
          payload: { providerType: 'studio', providerId: id },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('marks notifications for the authenticated user and keeps removal idempotent', async () => {
    const { app, tx } = setup();
    tx.one.mockResolvedValueOnce({ count: 3 });
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/me/notifications/read-all',
      headers,
      payload: { userId: 'other-user' },
    });
    expect(response.json()).toEqual({ data: { count: 3 } });
    expect(tx.one.mock.calls[0]?.[1]).toEqual(['client-id']);
    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/me/saved-providers/${id}`,
      headers,
    });
    expect(removed.statusCode).toBe(204);
    expect(tx.execute.mock.calls[0]?.[1]).toEqual([id, 'client-id']);
  });
});
