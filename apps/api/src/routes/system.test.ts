import { healthResponseSchema } from '@frameroom/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import type { Database } from '../repositories/database.js';

const apps: ReturnType<typeof buildApp>[] = [];
function createApp(env: Record<string, string> = {}, db?: Database) {
  const app = buildApp(envSchema.parse({ LOG_LEVEL: 'silent', ...env }), { db });
  apps.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('system routes', () => {
  it('keeps /health unenveloped and unauthenticated', async () => {
    const response = await createApp().inject({ url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ ok: true, service: 'api' });
  });

  it('reports nothing configured by default', async () => {
    const response = await createApp().inject({ url: '/v1/config' });
    expect(response.json()).toEqual({
      data: {
        authConfigured: false,
        databaseConfigured: false,
        storageConfigured: false,
        aiConfigured: false,
        aiSearchEnabled: false,
      },
    });
  });

  it('reports configured flags without leaking values', async () => {
    const response = await createApp(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-secret-value',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret-value',
        DATABASE_URL: 'postgres://user:db-secret@localhost:5432/postgres',
      },
      { isConfigured: true, run: async () => undefined as never, close: async () => {} },
    ).inject({ url: '/v1/config' });
    expect(response.json().data).toEqual({
      authConfigured: true,
      databaseConfigured: true,
      storageConfigured: true,
      aiConfigured: false,
      aiSearchEnabled: false,
    });
    expect(response.body).not.toMatch(/secret/);
  });

  it('exposes AI search only when both configuration and its feature flag are enabled', async () => {
    const enabled = await createApp({
      AI_GATEWAY_API_KEY: 'server-secret',
      AI_SEARCH_ENABLED: 'true',
    }).inject({ url: '/v1/config' });
    expect(enabled.json().data).toMatchObject({ aiConfigured: true, aiSearchEnabled: true });
    expect(enabled.body).not.toContain('server-secret');
    const disabled = await createApp({ AI_SEARCH_ENABLED: 'true' }).inject({ url: '/v1/config' });
    expect(disabled.json().data).toMatchObject({ aiConfigured: false, aiSearchEnabled: false });
  });

  it('serves the OpenAPI document without a token and documents the system routes', async () => {
    const response = await createApp().inject({ url: '/v1/openapi.json' });
    expect(response.statusCode).toBe(200);
    const document = response.json();
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/health', '/v1/config', '/v1/openapi.json']),
    );
    expect(document.paths['/v1/config'].get.security).toEqual([]);
  });

  it('treats empty .env.example values as unset', () => {
    const env = envSchema.parse({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '', DATABASE_URL: '' });
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
  });
});
