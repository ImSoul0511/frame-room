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
