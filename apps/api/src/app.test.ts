import { healthResponseSchema } from '@frameroom/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { envSchema } from './config/env.js';

const apps: ReturnType<typeof buildApp>[] = [];
function createApp() {
  const app = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }));
  apps.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('API foundation', () => {
  it('returns a healthy response matching the shared contract', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ ok: true, service: 'api' });
  });
  it('allows only the configured browser origin', async () => {
    const app = createApp();
    const allowed = await app.inject({
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const rejected = await app.inject({
      url: '/health',
      headers: { origin: 'https://untrusted.example' },
    });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' },
    });
    expect(preflight.statusCode).toBe(204);
    const blockedPreflight = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://untrusted.example', 'access-control-request-method': 'GET' },
    });
    expect(blockedPreflight.headers['access-control-allow-origin']).toBeUndefined();
  });
  it.each([
    { PORT: '' },
    { PORT: 'abc' },
    { PORT: '65536' },
    { WEB_ORIGIN: '*' },
    { WEB_ORIGIN: 'https://example.com/path' },
  ])('rejects invalid configuration: %j', (input) => {
    expect(envSchema.safeParse(input).success).toBe(false);
  });
  it('starts with defaults without database or AI credentials', () => {
    expect(envSchema.parse({})).toMatchObject({ PORT: 4000, WEB_ORIGIN: 'http://localhost:5173' });
  });
});
