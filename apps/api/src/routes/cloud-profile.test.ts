import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';

const USER = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const apps: ReturnType<typeof buildApp>[] = [];
function app(verified = true) {
  const instance = buildApp(
    envSchema.parse({
      LOG_LEVEL: 'silent',
      SUPABASE_URL: 'https://cloud.example.test',
      SUPABASE_ANON_KEY: 'public-test',
      SUPABASE_SERVICE_ROLE_KEY: 'server-test',
    }),
    {
      authenticate: async (authorization) => {
        if (!authorization) throw Object.assign(new Error('not authenticated'), { status: 401 });
        return { id: USER, isVerified: verified };
      },
    },
  );
  apps.push(instance);
  return instance;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
  vi.unstubAllGlobals();
});

describe('Cloud account route boundary', () => {
  it('rejects an unverified identity before accessing account tables', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await app(false).inject({
      method: 'POST',
      url: '/v1/me',
      headers: { authorization: 'Bearer test' },
      payload: { userName: 'demo_client', displayName: 'Demo Client' },
    });
    expect(response.statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ignores supplied identity and roles and only creates the verified caller profile', async () => {
    let reads = 0;
    const writes: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const path = new URL(url);
        if (init.method === 'POST') {
          writes.push(JSON.parse(String(init.body)) as Record<string, unknown>);
          expect(path.pathname).toBe('/rest/v1/profiles');
          return new Response(null, { status: 201 });
        }
        if (path.pathname.endsWith('/profiles')) {
          expect(path.searchParams.get('id')).toBe('eq.' + USER);
          return Response.json(
            ++reads === 1
              ? []
              : [
                  {
                    id: USER,
                    user_name: 'demo_client',
                    display_name: 'Demo Client',
                    created_at: '2026-11-19T00:00:00Z',
                  },
                ],
          );
        }
        expect(path.searchParams.get('user_id')).toBe('eq.' + USER);
        return Response.json([]);
      }),
    );
    const response = await app().inject({
      method: 'POST',
      url: '/v1/me',
      headers: { authorization: 'Bearer test' },
      payload: {
        id: FOREIGN,
        userName: 'demo_client',
        displayName: 'Demo Client',
        roles: ['system_admin'],
      },
    });
    expect(response.statusCode).toBe(201);
    expect(writes).toEqual([{ id: USER, user_name: 'demo_client', display_name: 'Demo Client' }]);
    expect(response.json().data.roles).toEqual(['client']);
  });
});
