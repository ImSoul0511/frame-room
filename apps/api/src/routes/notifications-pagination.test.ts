import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';

const actor = '11111111-1111-4111-8111-111111111111';
const rows = vi.fn();
const db: Database = {
  isConfigured: true,
  run: async (_id, action) => action({ rows } as unknown as Transaction),
  close: async () => {},
};
const apps: ReturnType<typeof buildApp>[] = [];
function app() {
  const instance = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }), {
    db,
    authenticate: async (header) => {
      if (!header) throw new ApiError(401, 'UNAUTHORIZED', 'authentication_required');
      return { id: actor, isVerified: true };
    },
  });
  apps.push(instance);
  return instance;
}
const notice = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  bookingId: null,
  studioId: null,
  event: 'bookingUpdated',
  createdAt: '2026-11-25T00:00:00.000Z',
  readAt: null,
});
beforeEach(() => rows.mockReset());
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});

describe('GET /v1/me/notifications/pages', () => {
  it('paginates and filters for the authenticated recipient', async () => {
    rows.mockResolvedValue([notice(1), notice(2), notice(3)]);
    const response = await app().inject({
      url: '/v1/me/notifications/pages?page=3&pageSize=2&unread=true',
      headers: { authorization: 'Bearer test' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ items: [notice(1), notice(2)], hasMore: true });
    expect(rows).toHaveBeenCalledWith(expect.stringContaining('recipient_id=$1'), [
      actor,
      true,
      3,
      4,
    ]);
    expect(rows.mock.calls[0][0]).toContain('read_at is null');
  });
  it('returns the last page without a next page', async () => {
    rows.mockResolvedValue([notice(1)]);
    const response = await app().inject({
      url: '/v1/me/notifications/pages?pageSize=2',
      headers: { authorization: 'Bearer test' },
    });
    expect(response.json().data).toEqual({ items: [notice(1)], hasMore: false });
    expect(rows).toHaveBeenCalledWith(expect.any(String), [actor, false, 3, 0]);
  });
  it('rejects invalid pagination and unauthenticated requests', async () => {
    const instance = app();
    const invalid = await instance.inject({
      url: '/v1/me/notifications/pages?page=0',
      headers: { authorization: 'Bearer test' },
    });
    const unauthorized = await instance.inject({ url: '/v1/me/notifications/pages' });
    expect(invalid.statusCode).toBe(400);
    expect(unauthorized.statusCode).toBe(401);
    expect(rows).not.toHaveBeenCalled();
  });
});
