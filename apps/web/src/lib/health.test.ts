import { afterEach, expect, it, vi } from 'vitest';

import { fetchHealth } from './health';

afterEach(() => {
  vi.unstubAllGlobals();
});
it('validates a successful API response', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true, service: 'api' })));
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchHealth('http://localhost:4000/')).resolves.toEqual({
    ok: true,
    service: 'api',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'http://localhost:4000/health',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
it('rejects an unexpected response instead of reporting a healthy API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }))));
  await expect(fetchHealth('http://localhost:4000')).rejects.toThrow();
});
it('rejects server failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  await expect(fetchHealth('http://localhost:4000')).rejects.toThrow('API health request failed');
});
