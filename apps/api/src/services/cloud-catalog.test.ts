import { afterEach, describe, expect, it, vi } from 'vitest';
import { envSchema } from '../config/env.js';
import { createCloudCatalog } from './cloud-catalog.js';

const USER = '11111111-1111-4111-8111-111111111111';
const PROFILE = {
  id: USER,
  user_name: 'demo_client',
  display_name: 'Demo Client',
  created_at: '2026-11-19T00:00:00Z',
};
const settings = envSchema.parse({
  SUPABASE_URL: 'https://cloud.example.test',
  SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-test-key',
});
afterEach(() => vi.unstubAllGlobals());

describe('Cloud catalog without a direct Postgres connection', () => {
  it('paginates filtered collections and excludes hidden-image and inactive tags', async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      const query = new URL(url);
      expect(new Headers(init.headers).get('apikey')).toBe('public-test-key');
      expect(query.searchParams.get('status')).toBe('eq.published');
      expect(query.searchParams.get('deleted_at')).toBe('is.null');
      expect(query.searchParams.get('offset')).toBe('12');
      expect(query.searchParams.get('limit')).toBe('12');
      expect(query.searchParams.get('order')).toBe('title.asc,id.asc');
      expect(query.searchParams.get('or')).toBe(
        '(title.ilike."%portrait%",description.ilike."%portrait%")',
      );
      expect(query.searchParams.get('matches.image_tags.tags.slug')).toBe('eq.soft');
      expect(query.searchParams.get('matches.is_hidden')).toBe('eq.false');
      const tag = {
        id: USER,
        name: 'Soft',
        name_vi: 'Dịu',
        category: 'mood',
        slug: 'soft',
        kind: 'mood',
      };
      return Response.json([
        {
          id: USER,
          title: 'Portrait',
          description: 'Natural light',
          genre: 'portrait',
          status: 'published',
          owner_type: 'photographer',
          photographers: { display_name: 'Mai' },
          photographer_id: USER,
          studio_id: null,
          published_at: '2026-11-19T00:00:00Z',
          created_at: '2026-11-19T00:00:00Z',
          updated_at: '2026-11-19T00:00:00Z',
          portfolio_images: [
            {
              storage_path: 'hidden.webp',
              sort_order: 0,
              is_hidden: true,
              image_tags: [
                { tags: { ...tag, id: '22222222-2222-4222-8222-222222222222', name: 'Hidden' } },
              ],
            },
            {
              storage_path: 'visible.webp',
              sort_order: 1,
              is_hidden: false,
              image_tags: [{ tags: tag }, { tags: { ...tag, is_active: false } }],
            },
          ],
        },
      ]);
    });
    vi.stubGlobal('fetch', fetch);
    const data = await createCloudCatalog(settings)!.portfolios({
      page: 2,
      pageSize: 12,
      q: 'portrait',
      sort: 'name',
      tag: 'soft',
    });
    expect(data[0].ownerName).toBe('Mai');
    expect(data[0].coverUrl).toContain('/visible.webp');
    expect(data[0].tags).toMatchObject([{ id: USER, nameVi: 'Dịu', category: 'mood' }]);
    expect(data[0].tags).toHaveLength(1);
  });
  it('uses public credentials and exact name matching in Cloud', async () => {
    const displayName = 'Nguyễn _ 100% *';
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      const request = new URL(url);
      expect(new Headers(init.headers).get('apikey')).toBe('public-test-key');
      if (request.pathname.endsWith('/providers')) {
        expect(request.searchParams.get('type')).toBe('eq.photographer');
        expect(request.searchParams.get('display_name')).toBe(`eq.${displayName}`);
        expect(request.searchParams.get('limit')).toBe('2');
        return Response.json([
          {
            id: USER,
            type: 'photographer',
            display_name: displayName,
            bio: '',
            city: '',
            district: '',
            genres: [],
            styles: [],
            price_from: null,
            rating_avg: null,
            review_count: 0,
          },
        ]);
      }
      if (request.pathname.endsWith('/photographers')) {
        expect(request.searchParams.get('id')).toBe(`eq.${USER}`);
        return Response.json([
          { cover_path: `${USER}/cover.webp`, profiles: { avatar_path: `${USER}/avatar.webp` } },
        ]);
      }
      expect(request.searchParams.get('photographer_id')).toBe(`eq.${USER}`);
      return Response.json([]);
    });
    vi.stubGlobal('fetch', fetch);
    await expect(
      createCloudCatalog(settings)!.detail('photographer', { displayName }),
    ).resolves.toMatchObject({
      provider: { id: USER, displayName },
      services: [],
      coverPath: `${USER}/cover.webp`,
      avatarPath: `${USER}/avatar.webp`,
    });
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('never reads gallery images for an unpublished or deleted portfolio', async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      const query = new URL(url);
      expect(query.pathname).toBe('/rest/v1/portfolios');
      expect(query.searchParams.get('status')).toBe('eq.published');
      expect(query.searchParams.get('deleted_at')).toBe('is.null');
      expect(new Headers(init.headers).get('apikey')).toBe('public-test-key');
      return Response.json([]);
    });
    vi.stubGlobal('fetch', fetch);
    await expect(createCloudCatalog(settings)!.portfolio(USER)).rejects.toMatchObject({
      status: 404,
      reason: 'portfolio_not_found',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('filters hidden gallery images and tolerates absent legacy source metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const query = new URL(url);
        if (query.pathname.endsWith('/portfolios'))
          return Response.json([
            {
              id: USER,
              title: 'Public album',
              description: '',
              genre: 'portrait',
              status: 'published',
              owner_type: 'photographer',
              photographer_id: USER,
              studio_id: null,
              published_at: '2026-11-19T00:00:00Z',
              created_at: '2026-11-19T00:00:00Z',
              updated_at: '2026-11-19T00:00:00Z',
            },
          ]);
        if (query.pathname.endsWith('/providers')) return Response.json([{ id: USER }]);
        expect(query.pathname).toBe('/rest/v1/portfolio_images');
        expect(query.searchParams.get('is_hidden')).toBe('eq.false');
        expect(query.searchParams.get('portfolio_id')).toBe('eq.' + USER);
        return Response.json([
          {
            id: USER,
            portfolio_id: USER,
            storage_path: 'public/photo.webp',
            width: 800,
            height: 1000,
            caption: 'Portrait',
            sort_order: 0,
            provenance: 'captured',
            is_hidden: false,
            created_at: '2026-11-19T00:00:00Z',
            image_tags: [],
          },
        ]);
      }),
    );
    const album = await createCloudCatalog(settings)!.portfolio(USER);
    expect(album.images[0]).toMatchObject({
      source: null,
      licenseNote: null,
      url: 'https://cloud.example.test/storage/v1/object/public/portfolio-images/public/photo.webp',
    });
  });
  it('uses only the public credential for discovery and retains an empty cover', async () => {
    const calls: { url: URL; headers: Headers }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: new URL(url), headers: new Headers(init.headers) });
        return Response.json(
          url.includes('/providers')
            ? [
                {
                  id: USER,
                  type: 'photographer',
                  display_name: 'Demo',
                  bio: '',
                  city: '',
                  district: '',
                  genres: ['portrait'],
                  styles: [],
                  price_from: null,
                  rating_avg: null,
                  review_count: 0,
                },
              ]
            : [],
        );
      }),
    );
    const data = await createCloudCatalog(settings)!.list({
      page: 1,
      pageSize: 24,
      genre: 'portrait',
    });
    expect(data[0]).toMatchObject({ displayName: 'Demo', coverUrl: null });
    expect(calls.every((call) => call.headers.get('apikey') === 'public-test-key')).toBe(true);
    expect(calls[0].url.searchParams.get('genres')).toBe('cs.{portrait}');
    expect(calls[1].url.searchParams.get('status')).toBe('eq.published');
    expect(calls[1].url.searchParams.get('deleted_at')).toBe('is.null');
  });
  it('includes photographer username and avatar in directory results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/providers'))
          return Response.json([
            {
              id: USER,
              type: 'photographer',
              display_name: 'Demo',
              bio: '',
              city: '',
              district: '',
              genres: [],
              styles: [],
              price_from: null,
              rating_avg: null,
              review_count: 0,
            },
          ]);
        if (url.includes('/photographers'))
          return Response.json([
            { id: USER, profiles: { user_name: 'demo', avatar_path: `${USER}/avatar.webp` } },
          ]);
        return Response.json([]);
      }),
    );
    const data = await createCloudCatalog(settings)!.list(
      { page: 1, pageSize: 12 },
      'photographer',
    );
    expect(data[0]).toMatchObject({ userName: 'demo', avatarPath: `${USER}/avatar.webp` });
  });
  it('accepts nullable Vietnamese names and omits inactive database tags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          {
            id: USER,
            name: 'Portrait',
            slug: 'portrait',
            kind: 'setting',
            category: 'genre',
            name_vi: null,
            is_active: true,
          },
          { id: USER, name: 'Hidden', slug: 'hidden', kind: 'mood', is_active: false },
        ]),
      ),
    );
    await expect(createCloudCatalog(settings)!.tags()).resolves.toEqual([
      {
        id: USER,
        name: 'Portrait',
        slug: 'portrait',
        kind: 'setting',
        category: 'genre',
        nameVi: null,
      },
    ]);
  });
  it('reports an incomplete profile without creating it during a read', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('GET');
      return Response.json([]);
    });
    vi.stubGlobal('fetch', fetch);
    await expect(createCloudCatalog(settings)!.profile(USER)).rejects.toMatchObject({
      status: 404,
      reason: 'profile_required',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('returns the existing own profile on a repeated create and derives roles from rows', async () => {
    const calls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        expect(init.method).toBe('GET');
        const parsed = new URL(url);
        calls.push(parsed);
        return Response.json(parsed.pathname.endsWith('/profiles') ? [PROFILE] : []);
      }),
    );
    const result = await createCloudCatalog(settings)!.createProfile(USER, {
      userName: 'changed',
      displayName: 'Changed',
    });
    expect(result).toMatchObject({
      created: false,
      profile: { userName: 'demo_client', roles: ['client'] },
    });
    expect(
      calls.every(
        (url) =>
          url.searchParams.get(url.pathname.endsWith('/profiles') ? 'id' : 'user_id') ===
          'eq.' + USER,
      ),
    ).toBe(true);
  });
  it('recovers a same-user creation race without renaming the existing profile', async () => {
    let profileReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (init.method === 'POST') {
          expect(JSON.parse(String(init.body))).toMatchObject({
            id: USER,
            user_name: 'demo_client',
          });
          return Response.json({ code: '23505', message: 'duplicate' }, { status: 409 });
        }
        if (new URL(url).pathname.endsWith('/profiles'))
          return Response.json(++profileReads === 1 ? [] : [PROFILE]);
        return Response.json([]);
      }),
    );
    await expect(
      createCloudCatalog(settings)!.createProfile(USER, {
        userName: 'demo_client',
        displayName: 'Demo Client',
      }),
    ).resolves.toMatchObject({ created: false, profile: { id: USER } });
  });
});
