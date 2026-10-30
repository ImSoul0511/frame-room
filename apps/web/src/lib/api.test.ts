import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));
import { api, RequestError } from './api';
import { languageStore } from './locale-store';
afterEach(() => {
  vi.unstubAllGlobals();
  languageStore.setLanguage('en');
});
describe('localized API boundary', () => {
  it('handles successful 204 responses for delete actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    expect(await api('/v1/resources/example', { method: 'DELETE' })).toBeUndefined();
  });
  it('rejects missing response data rather than silently returning undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ unexpected: true })),
    );
    await expect(api('/v1/me')).rejects.toMatchObject({ reason: 'invalid_response' });
  });
  it('sends selected language and translates existing machine errors after switching', async () => {
    const fetch = vi.fn(async () => Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    const error = new RequestError(409, 'slot_overlap');
    expect(error.message).toContain('photographer');
    languageStore.setLanguage('vi');
    await api('/v1/explore');
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toBeInstanceOf(
      Headers,
    );
    expect(
      new Headers((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get(
        'accept-language',
      ),
    ).toBe('vi');
    expect(error.message).toMatch(/nhiếp ảnh gia/i);
  });
});
