import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH, bodyData, buildTestApp, closeTestApps } from '../../test/helpers/build-test-app.js';
import * as repo from '../repositories/catalog.js';
import * as profileRepo from '../repositories/profiles.js';
import type { PublicPortfolio, PublicReview, Tag, Provider, Service } from '../schemas/catalog.js';

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
