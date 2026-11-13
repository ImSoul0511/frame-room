import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH, bodyData, buildTestApp, closeTestApps } from '../../test/helpers/build-test-app.js';
import * as repo from '../repositories/catalog.js';
import * as profileRepo from '../repositories/profiles.js';
import type {
  PublicPortfolio,
  PublicReview,
  Tag,
  Provider,
  Service,
  Studio,
  OwnedService,
  OwnedPortfolio,
  ServiceAddOn,
  StudioInvitation,
  StudioResource,
} from '../schemas/catalog.js';

vi.mock('../repositories/catalog.js');
vi.mock('../repositories/profiles.js');

const PHOTOGRAPHER_ID = '22222222-2222-4222-8222-222222222222';
const STUDIO_ID = '33333333-3333-4333-8333-333333333333';
const SERVICE_ID = '44444444-4444-4444-8444-444444444444';
const PORTFOLIO_ID = '55555555-5555-4555-8555-555555555555';
const REVIEW_ID = '66666666-6666-4666-8666-666666666666';
const BOOKING_ID = '77777777-7777-4777-8777-777777777777';
const AUTHOR_ID = '88888888-8888-4888-8888-888888888888';
const TAG_ID = '99999999-9999-4999-8999-999999999999';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const PHOTOGRAPHER_PROVIDER: Provider = {
  id: PHOTOGRAPHER_ID,
  type: 'photographer',
  displayName: 'Minh Lens',
  bio: 'Portrait photographer',
  city: 'Ho Chi Minh',
  district: 'District 1',
  genres: ['portrait', 'fashion'],
  styles: ['cinematic'],
  priceFrom: 1500000,
  ratingAvg: 4.8,
  reviewCount: 12,
};

const STUDIO_PROVIDER: Provider = {
  ...PHOTOGRAPHER_PROVIDER,
  id: STUDIO_ID,
  type: 'studio',
  displayName: 'Daylight Studio',
};

const SERVICE: Service = {
  id: SERVICE_ID,
  name: 'Standard Portrait',
  description: '2 hours shoot',
  genre: 'portrait',
  durationMinutes: 120,
  price: 1500000,
  photoCount: 20,
  retouchedCount: 10,
  isActive: true,
  ownerType: 'photographer',
  photographerId: PHOTOGRAPHER_ID,
  studioId: null,
};

const PORTFOLIO: PublicPortfolio = {
  id: PORTFOLIO_ID,
  title: 'Editorial 2026',
  description: 'Selected works',
  genre: 'portrait',
  status: 'published',
  ownerType: 'photographer',
  photographerId: PHOTOGRAPHER_ID,
  studioId: null,
  publishedAt: '2026-11-13T00:00:00.000Z',
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

const REVIEW: PublicReview = {
  id: REVIEW_ID,
  bookingId: BOOKING_ID,
  authorId: AUTHOR_ID,
  authorName: 'Lan Anh',
  photographerId: PHOTOGRAPHER_ID,
  studioId: null,
  rating: 5,
  comment: 'Great session',
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

const TAG: Tag = {
  id: TAG_ID,
  name: 'Warm',
  slug: 'warm',
  kind: 'tone',
};

const NONE = undefined as never;

beforeEach(() => vi.resetAllMocks());
afterEach(closeTestApps);

describe('GET /v1/explore', () => {
  it('returns public providers with coverUrl and applies default pagination without auth', async () => {
    vi.mocked(repo.discoverProviders).mockResolvedValue([PHOTOGRAPHER_PROVIDER]);
    vi.mocked(repo.findProviderCoverPath).mockResolvedValue('user-1/port-1/cover.webp');

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/explore?genre=portrait&city=Ho%20Chi%20Minh&priceMax=2000000&page=1&pageSize=10',
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([
      expect.objectContaining({
        id: PHOTOGRAPHER_ID,
        displayName: 'Minh Lens',
        coverUrl: expect.stringContaining('user-1/port-1/cover.webp'),
      }),
    ]);
    expect(repo.discoverProviders).toHaveBeenCalledWith(expect.anything(), {
      genre: 'portrait',
      city: 'Ho Chi Minh',
      priceMax: 2000000,
      page: 1,
      pageSize: 10,
    });
  });

  it('returns 400 when pageSize exceeds 50 or genre is invalid', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/explore?pageSize=51',
    });
    expect(res.statusCode).toBe(400);
    expect(repo.discoverProviders).not.toHaveBeenCalled();
  });
});

describe('GET /v1/photographers and GET /v1/photographers/:id', () => {
  it('lists public photographers (200)', async () => {
    vi.mocked(repo.listProvidersByType).mockResolvedValue([PHOTOGRAPHER_PROVIDER]);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/photographers' });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([PHOTOGRAPHER_PROVIDER]);
    expect(repo.listProvidersByType).toHaveBeenCalledWith(expect.anything(), 'photographer');
  });

  it('returns photographer detail with active services, published portfolios and visible reviews', async () => {
    vi.mocked(repo.findProviderById).mockResolvedValue(PHOTOGRAPHER_PROVIDER);
    vi.mocked(repo.listActiveServicesByProvider).mockResolvedValue([SERVICE]);
    vi.mocked(repo.listPublishedPortfoliosByProvider).mockResolvedValue([PORTFOLIO]);
    vi.mocked(repo.findPortfolioCoverPath).mockResolvedValue(NONE);
    vi.mocked(repo.listVisibleReviewsByProvider).mockResolvedValue([REVIEW]);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/photographers/${PHOTOGRAPHER_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({
      provider: { id: PHOTOGRAPHER_ID, type: 'photographer' },
      services: [{ id: SERVICE_ID }],
      portfolios: [{ id: PORTFOLIO_ID, coverUrl: null }],
      reviews: [{ id: REVIEW_ID, authorName: 'Lan Anh' }],
    });
  });

  it('returns 404 photographer_not_found when missing or hidden', async () => {
    vi.mocked(repo.findProviderById).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/photographers/${PHOTOGRAPHER_ID}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('photographer_not_found');
  });

  it('returns 400 when :id is not a valid UUID', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/photographers/not-a-uuid' });
    expect(res.statusCode).toBe(400);
  });

  it('keeps static /v1/photographers/me matched before /v1/photographers/:id', async () => {
    vi.mocked(profileRepo.findPhotographer).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/photographers/me',
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(repo.findProviderById).not.toHaveBeenCalled();
  });
});

describe('GET /v1/studios and GET /v1/studios/:id', () => {
  it('lists public studios (200)', async () => {
    vi.mocked(repo.listProvidersByType).mockResolvedValue([STUDIO_PROVIDER]);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/studios' });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([STUDIO_PROVIDER]);
    expect(repo.listProvidersByType).toHaveBeenCalledWith(expect.anything(), 'studio');
  });

  it('returns 404 studio_not_found when studio is missing or hidden', async () => {
    vi.mocked(repo.findProviderById).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/studios/${STUDIO_ID}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('studio_not_found');
  });
});

describe('GET /v1/tags', () => {
  it('returns all tags ordered by kind and name', async () => {
    vi.mocked(repo.listTags).mockResolvedValue([TAG]);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/tags' });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([TAG]);
  });
});

// ---------- 102b: Studios & Team ----------

const STUDIO_INPUT = {
  name: 'Daylight Studio',
  description: 'Natural light studio in D1',
  city: 'Ho Chi Minh',
  district: 'District 1',
  address: '123 Le Loi',
  genres: ['portrait', 'fashion'] as const,
};

const STUDIO: Studio = {
  ...STUDIO_INPUT,
  genres: ['portrait', 'fashion'],
  id: STUDIO_ID,
  createdBy: USER_ID,
  isHidden: false,
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

describe('GET /v1/me/studios', () => {
  it('returns studios where the caller is a member (200)', async () => {
    vi.mocked(repo.listStudiosByMember).mockResolvedValue([{ ...STUDIO, role: 'manager' }]);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me/studios', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([expect.objectContaining({ id: STUDIO_ID, role: 'manager' })]);
    expect(repo.listStudiosByMember).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me/studios' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /v1/studios', () => {
  it('creates a studio and adds the caller as initial manager (201)', async () => {
    vi.mocked(repo.photographerExistsByUser).mockResolvedValue(true);
    vi.mocked(repo.insertStudio).mockResolvedValue(STUDIO);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/studios',
      payload: STUDIO_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ id: STUDIO_ID, name: 'Daylight Studio' });
    expect(repo.insertStudioMember).toHaveBeenCalledWith(
      expect.anything(),
      STUDIO_ID,
      'user-1',
      'manager',
    );
  });

  it('returns 403 photographer_required when caller has no photographer profile', async () => {
    vi.mocked(repo.photographerExistsByUser).mockResolvedValue(false);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/studios',
      payload: STUDIO_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('photographer_required');
    expect(repo.insertStudio).not.toHaveBeenCalled();
  });
});

describe('PATCH /v1/studios/:id', () => {
  it('updates studio details when caller is a current manager (200)', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.updateStudio).mockResolvedValue({ ...STUDIO, name: 'Updated Studio' });

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/studios/${STUDIO_ID}`,
      payload: { ...STUDIO_INPUT, name: 'Updated Studio' },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ name: 'Updated Studio' });
  });

  it('returns 403 manager_required when caller is not a manager', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(false);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/studios/${STUDIO_ID}`,
      payload: STUDIO_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('manager_required');
    expect(repo.updateStudio).not.toHaveBeenCalled();
  });
});

describe('GET /v1/studios/:id/team', () => {
  it('returns team members for a studio manager (200)', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.listStudioTeam).mockResolvedValue([
      {
        studioId: STUDIO_ID,
        userId: USER_ID,
        role: 'manager',
        joinedAt: '2026-11-13T00:00:00.000Z',
        displayName: 'Khai',
        userName: 'khai',
        photographerId: PHOTOGRAPHER_ID,
      },
    ]);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/studios/${STUDIO_ID}/team`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        role: 'manager',
        photographerId: PHOTOGRAPHER_ID,
      }),
    ]);
  });

  it('returns 403 manager_required when caller is not a manager', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(false);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/studios/${STUDIO_ID}/team`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('manager_required');
  });
});

// ---------- 102c: Services ----------

const SERVICE_INPUT = {
  name: 'Standard Portrait',
  description: '2 hours shoot',
  genre: 'portrait' as const,
  durationMinutes: 120,
  price: 1500000,
  photoCount: 20,
  retouchedCount: 10,
  isActive: true,
};

const OWNED_SERVICE: OwnedService = {
  ...SERVICE_INPUT,
  id: SERVICE_ID,
  ownerType: 'photographer',
  photographerId: PHOTOGRAPHER_ID,
  studioId: null,
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

describe('GET /v1/me/services', () => {
  it('lists services owned by the caller or managed studios (200)', async () => {
    vi.mocked(repo.listOwnedServices).mockResolvedValue([OWNED_SERVICE]);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me/services', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([expect.objectContaining({ id: SERVICE_ID })]);
    expect(repo.listOwnedServices).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });
});

describe('POST /v1/services and POST /v1/studios/:id/services', () => {
  it('creates a personal service when caller has a photographer profile (201)', async () => {
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.insertService).mockResolvedValue(OWNED_SERVICE);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: SERVICE_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ id: SERVICE_ID, ownerType: 'photographer' });
    expect(repo.insertService).toHaveBeenCalledWith(
      expect.anything(),
      { ownerType: 'photographer', photographerId: PHOTOGRAPHER_ID },
      expect.objectContaining({ name: 'Standard Portrait' }),
    );
  });

  it('returns 403 photographer_required when creating personal service without photographer profile', async () => {
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(NONE);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: SERVICE_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('photographer_required');
  });

  it('creates a studio service when caller is a current manager (201)', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.insertService).mockResolvedValue({
      ...OWNED_SERVICE,
      ownerType: 'studio',
      photographerId: null,
      studioId: STUDIO_ID,
    });

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/studios/${STUDIO_ID}/services`,
      payload: SERVICE_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ ownerType: 'studio', studioId: STUDIO_ID });
  });

  it('returns 403 manager_required when non-manager creates a studio service', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(false);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/studios/${STUDIO_ID}/services`,
      payload: SERVICE_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('manager_required');
  });
});

describe('PATCH /v1/services/:id and DELETE /v1/services/:id', () => {
  it('updates an owned personal service (200)', async () => {
    vi.mocked(repo.findServiceOwnership).mockResolvedValue({
      id: SERVICE_ID,
      photographerId: PHOTOGRAPHER_ID,
      studioId: null,
    });
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.updateService).mockResolvedValue({ ...OWNED_SERVICE, price: 2000000 });

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/services/${SERVICE_ID}`,
      payload: { ...SERVICE_INPUT, price: 2000000 },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ price: 2000000 });
  });

  it('returns 403 not_provider_owner when updating another photographer service', async () => {
    vi.mocked(repo.findServiceOwnership).mockResolvedValue({
      id: SERVICE_ID,
      photographerId: PHOTOGRAPHER_ID,
      studioId: null,
    });
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(NONE);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/services/${SERVICE_ID}`,
      payload: SERVICE_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('not_provider_owner');
  });

  it('returns 404 service_not_found when deleting a missing service', async () => {
    vi.mocked(repo.findServiceOwnership).mockResolvedValue(NONE);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/services/${SERVICE_ID}`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('service_not_found');
  });

  it('soft-deletes an owned studio service and returns 204', async () => {
    vi.mocked(repo.findServiceOwnership).mockResolvedValue({
      id: SERVICE_ID,
      photographerId: null,
      studioId: STUDIO_ID,
    });
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/services/${SERVICE_ID}`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(repo.softDeleteService).toHaveBeenCalledWith(expect.anything(), SERVICE_ID);
  });
});

// ---------- 102d: Portfolios & Images ----------

const IMAGE_ID = '55555555-5555-4555-8555-555555555555';

const PORTFOLIO_INPUT = {
  title: 'Golden Hour Portraits',
  description: 'Shot in Saigon at sunset',
  genre: 'portrait' as const,
  status: 'published' as const,
};

const OWNED_PORTFOLIO: OwnedPortfolio = {
  ...PORTFOLIO_INPUT,
  id: PORTFOLIO_ID,
  ownerType: 'photographer',
  photographerId: PHOTOGRAPHER_ID,
  studioId: null,
  publishedAt: '2026-11-13T00:00:00.000Z',
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

describe('GET /v1/me/portfolios and GET /v1/portfolios', () => {
  it('lists portfolios owned by the caller (200)', async () => {
    vi.mocked(repo.listOwnedPortfolios).mockResolvedValue([OWNED_PORTFOLIO]);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me/portfolios', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([expect.objectContaining({ id: PORTFOLIO_ID })]);
  });

  it('lists public published portfolios with coverUrl (200)', async () => {
    vi.mocked(repo.listPublicPortfolios).mockResolvedValue([OWNED_PORTFOLIO]);
    vi.mocked(repo.findPortfolioCoverPath).mockResolvedValue('covers/golden.jpg');

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/portfolios?genre=portrait&tag=warm-tone',
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([
      expect.objectContaining({
        id: PORTFOLIO_ID,
        coverUrl: 'covers/golden.jpg',
      }),
    ]);
  });
});

describe('GET /v1/portfolios/:id', () => {
  it('returns published portfolio detail with images and tags (200)', async () => {
    vi.mocked(repo.findPortfolioById).mockResolvedValue(OWNED_PORTFOLIO);
    vi.mocked(repo.isPortfolioProviderVisible).mockResolvedValue(true);
    vi.mocked(repo.listVisiblePortfolioImages).mockResolvedValue([
      {
        id: IMAGE_ID,
        portfolioId: PORTFOLIO_ID,
        storagePath: 'p/img1.jpg',
        caption: 'Frame 1',
        sortOrder: 0,
        isHidden: false,
        createdAt: '2026-11-13T00:00:00.000Z',
      },
    ]);
    vi.mocked(repo.listTagsForImage).mockResolvedValue([TAG]);

    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: `/v1/portfolios/${PORTFOLIO_ID}` });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({
      id: PORTFOLIO_ID,
      images: [
        expect.objectContaining({
          id: IMAGE_ID,
          url: 'p/img1.jpg',
          tags: [TAG],
        }),
      ],
    });
  });

  it('returns 404 portfolio_not_found for a draft portfolio requested by non-owner', async () => {
    vi.mocked(repo.findPortfolioById).mockResolvedValue({ ...OWNED_PORTFOLIO, status: 'draft' });

    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: `/v1/portfolios/${PORTFOLIO_ID}` });

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('portfolio_not_found');
  });
});

describe('POST /v1/portfolios, POST /v1/studios/:id/portfolios, PATCH & DELETE /v1/portfolios/:id', () => {
  it('creates a personal portfolio (201)', async () => {
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.insertPortfolio).mockResolvedValue(OWNED_PORTFOLIO);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/portfolios',
      payload: PORTFOLIO_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ id: PORTFOLIO_ID, ownerType: 'photographer' });
  });

  it('creates a studio portfolio for a manager (201)', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.insertPortfolio).mockResolvedValue({
      ...OWNED_PORTFOLIO,
      ownerType: 'studio',
      photographerId: null,
      studioId: STUDIO_ID,
    });

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/studios/${STUDIO_ID}/portfolios`,
      payload: PORTFOLIO_INPUT,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ ownerType: 'studio', studioId: STUDIO_ID });
  });

  it('updates an owned portfolio (200) and soft-deletes it (204)', async () => {
    vi.mocked(repo.findPortfolioById).mockResolvedValue(OWNED_PORTFOLIO);
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.updatePortfolio).mockResolvedValue({ ...OWNED_PORTFOLIO, title: 'Updated' });

    const app = await buildTestApp();
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/portfolios/${PORTFOLIO_ID}`,
      payload: { ...PORTFOLIO_INPUT, title: 'Updated' },
      headers: AUTH,
    });
    expect(patchRes.statusCode).toBe(200);
    expect(bodyData(patchRes)).toMatchObject({ title: 'Updated' });

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/portfolios/${PORTFOLIO_ID}`,
      headers: AUTH,
    });
    expect(delRes.statusCode).toBe(204);
    expect(repo.softDeletePortfolio).toHaveBeenCalledWith(expect.anything(), PORTFOLIO_ID);
  });
});

describe('POST /v1/portfolios/:id/images and PATCH /v1/portfolio-images/:id/tags', () => {
  it('attaches an image with tags to an owned portfolio (201)', async () => {
    vi.mocked(repo.findPortfolioById).mockResolvedValue(OWNED_PORTFOLIO);
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.insertPortfolioImage).mockResolvedValue({
      id: IMAGE_ID,
      portfolioId: PORTFOLIO_ID,
      storagePath: 'p/new.jpg',
      caption: 'New frame',
      sortOrder: 1,
      isHidden: false,
      createdAt: '2026-11-13T00:00:00.000Z',
    });
    vi.mocked(repo.replacePortfolioImageTags).mockResolvedValue([TAG]);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/portfolios/${PORTFOLIO_ID}/images`,
      payload: {
        storagePath: 'p/new.jpg',
        caption: 'New frame',
        sortOrder: 1,
        tagIds: [TAG.id],
      },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({
      id: IMAGE_ID,
      url: 'p/new.jpg',
      tags: [TAG],
    });
  });

  it('replaces tags on an owned portfolio image (200)', async () => {
    vi.mocked(repo.findImagePortfolioOwnership).mockResolvedValue({
      imageId: IMAGE_ID,
      portfolioId: PORTFOLIO_ID,
      photographerId: PHOTOGRAPHER_ID,
      studioId: null,
    });
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.replacePortfolioImageTags).mockResolvedValue([TAG]);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/portfolio-images/${IMAGE_ID}/tags`,
      payload: { tagIds: [TAG.id] },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([TAG]);
  });

  it('returns 403 not_provider_owner when modifying tags on another user image', async () => {
    vi.mocked(repo.findImagePortfolioOwnership).mockResolvedValue({
      imageId: IMAGE_ID,
      portfolioId: PORTFOLIO_ID,
      photographerId: PHOTOGRAPHER_ID,
      studioId: null,
    });
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(NONE);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/portfolio-images/${IMAGE_ID}/tags`,
      payload: { tagIds: [TAG.id] },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('not_provider_owner');
  });
});

// ---------- 102e: Invitations, Members, Resources & Add-ons ----------

const INVITATION_ID = '77777777-7777-4777-8777-777777777777';
const RESOURCE_ID = '88888888-8888-4888-8888-888888888888';
const ADDON_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TARGET_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const INVITATION: StudioInvitation = {
  id: INVITATION_ID,
  studioId: STUDIO_ID,
  photographerId: PHOTOGRAPHER_ID,
  role: 'photographer',
  status: 'pending',
  invitedBy: USER_ID,
  respondedAt: null,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
};

const RESOURCE: StudioResource = {
  id: RESOURCE_ID,
  studioId: STUDIO_ID,
  name: 'Cyclorama Wall A',
  type: 'room',
  description: '6m x 8m white cyc',
  isActive: true,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
};

const ADDON: ServiceAddOn = {
  id: ADDON_ID,
  serviceId: SERVICE_ID,
  name: 'Extra 10 Retouched Photos',
  description: 'High-end skin retouching',
  price: 500000,
  isActive: true,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
};

describe('Studio invitations (/v1/me/invitations, POST /v1/studios/:id/invitations, PATCH /v1/invitations/:id)', () => {
  it('lists pending invitations for the caller (200)', async () => {
    vi.mocked(repo.listPendingInvitationsForUser).mockResolvedValue([
      { ...INVITATION, studioName: 'Daylight Studio', inviterName: 'Khai' },
    ]);

    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me/invitations', headers: AUTH });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toEqual([
      expect.objectContaining({ id: INVITATION_ID, studioName: 'Daylight Studio' }),
    ]);
  });

  it('creates an invitation when caller is a studio manager (201)', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.findPhotographerUserId).mockResolvedValue(TARGET_USER_ID);
    vi.mocked(repo.isStudioMember).mockResolvedValue(false);
    vi.mocked(repo.hasPendingStudioInvitation).mockResolvedValue(false);
    vi.mocked(repo.insertStudioInvitation).mockResolvedValue(INVITATION);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/studios/${STUDIO_ID}/invitations`,
      payload: { photographerId: PHOTOGRAPHER_ID, role: 'photographer' },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ id: INVITATION_ID, status: 'pending' });
  });

  it('accepts a pending invitation and adds the user to studio_members (200)', async () => {
    vi.mocked(repo.findInvitationWithRecipient).mockResolvedValue({
      ...INVITATION,
      recipientUserId: 'user-1',
    });
    vi.mocked(repo.updateInvitationStatus).mockResolvedValue({
      ...INVITATION,
      status: 'accepted',
      respondedAt: '2026-11-14T01:00:00.000Z',
    });

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/invitations/${INVITATION_ID}`,
      payload: { action: 'accept' },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ status: 'accepted' });
    expect(repo.insertStudioMember).toHaveBeenCalledWith(
      expect.anything(),
      STUDIO_ID,
      'user-1',
      'photographer',
    );
  });
});

describe('Studio member role updates and removal guards', () => {
  it('blocks demoting the last studio manager with 409 last_manager_protected', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.findStudioMemberRole).mockResolvedValue('manager');
    vi.mocked(repo.countStudioManagers).mockResolvedValue(1);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/studios/${STUDIO_ID}/members/${TARGET_USER_ID}`,
      payload: { role: 'photographer' },
      headers: AUTH,
    });

    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('last_manager_protected');
  });

  it('blocks removing a member with active studio booking assignments (409)', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.findStudioMemberRole).mockResolvedValue('photographer');
    vi.mocked(repo.hasActiveStudioBookingAssignments).mockResolvedValue(true);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/studios/${STUDIO_ID}/members/${TARGET_USER_ID}`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('active_booking_assignments');
  });

  it('removes a member when guards pass and returns 204', async () => {
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.findStudioMemberRole).mockResolvedValue('photographer');
    vi.mocked(repo.hasActiveStudioBookingAssignments).mockResolvedValue(false);

    const app = await buildTestApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/studios/${STUDIO_ID}/members/${TARGET_USER_ID}`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(204);
    expect(repo.deleteStudioMember).toHaveBeenCalledWith(
      expect.anything(),
      STUDIO_ID,
      TARGET_USER_ID,
    );
  });
});

describe('Studio resources and service add-ons', () => {
  it('lists, creates, updates, and soft-deletes studio resources', async () => {
    vi.mocked(repo.listStudioResources).mockResolvedValue([RESOURCE]);
    vi.mocked(repo.isStudioManager).mockResolvedValue(true);
    vi.mocked(repo.insertStudioResource).mockResolvedValue(RESOURCE);
    vi.mocked(repo.findResourceStudioId).mockResolvedValue(STUDIO_ID);
    vi.mocked(repo.updateStudioResource).mockResolvedValue({ ...RESOURCE, name: 'Room B' });

    const app = await buildTestApp();

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/studios/${STUDIO_ID}/resources`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(bodyData(listRes)).toEqual([expect.objectContaining({ id: RESOURCE_ID })]);

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/studios/${STUDIO_ID}/resources`,
      payload: {
        name: 'Cyclorama Wall A',
        type: 'room',
        description: '6m x 8m white cyc',
        isActive: true,
      },
      headers: AUTH,
    });
    expect(createRes.statusCode).toBe(201);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/resources/${RESOURCE_ID}`,
      payload: {
        name: 'Room B',
        type: 'room',
        description: '6m x 8m white cyc',
        isActive: true,
      },
      headers: AUTH,
    });
    expect(patchRes.statusCode).toBe(200);
    expect(bodyData(patchRes)).toMatchObject({ name: 'Room B' });

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/resources/${RESOURCE_ID}`,
      headers: AUTH,
    });
    expect(delRes.statusCode).toBe(204);
    expect(repo.softDeleteStudioResource).toHaveBeenCalledWith(expect.anything(), RESOURCE_ID);
  });

  it('lists and creates add-ons for an owned service', async () => {
    vi.mocked(repo.findServiceOwnership).mockResolvedValue({
      id: SERVICE_ID,
      photographerId: PHOTOGRAPHER_ID,
      studioId: null,
    });
    vi.mocked(repo.listServiceAddOns).mockResolvedValue([ADDON]);
    vi.mocked(repo.findPhotographerIdByUser).mockResolvedValue(PHOTOGRAPHER_ID);
    vi.mocked(repo.insertServiceAddOn).mockResolvedValue(ADDON);

    const app = await buildTestApp();

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/services/${SERVICE_ID}/add-ons`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(bodyData(listRes)).toEqual([expect.objectContaining({ id: ADDON_ID })]);

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/services/${SERVICE_ID}/add-ons`,
      payload: {
        name: 'Extra 10 Retouched Photos',
        description: 'High-end skin retouching',
        price: 500000,
        isActive: true,
      },
      headers: AUTH,
    });
    expect(createRes.statusCode).toBe(201);
    expect(bodyData(createRes)).toMatchObject({ id: ADDON_ID, price: 500000 });
  });
});
