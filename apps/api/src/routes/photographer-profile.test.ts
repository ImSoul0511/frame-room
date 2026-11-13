// apps/api/src/routes/photographer-profile.test.ts
import type { Profile } from '@frameroom/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH, bodyData, buildTestApp, closeTestApps } from '../../test/helpers/build-test-app.js';
import * as repo from '../repositories/profiles.js';
import type { OwnPhotographer } from '../schemas/own-photographer.js';

vi.mock('../repositories/profiles.js');

// Khớp photographerInputSchema (genres bắt buộc, 1-5 phần tử) và ownPhotographerSchema.
const PHOTOG_INPUT = { displayName: 'Khai Photo', genres: ['portrait'] };
const PHOTOG_ID = '22222222-2222-4222-8222-222222222222';
const PHOTOG: OwnPhotographer = {
  id: PHOTOG_ID,
  userId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Khai Photo',
  bio: '',
  city: '',
  district: '',
  genres: ['portrait'],
  styles: [],
  isHidden: false,
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};
const PROFILE: Profile = {
  id: '11111111-1111-4111-8111-111111111111',
  userName: 'khai',
  displayName: 'Khai',
  roles: ['client'],
  createdAt: '2026-11-13T00:00:00.000Z',
};

// Giá trị mock "không có" mà không dùng any.
const NONE = undefined as never;

const uniqueViolation = (constraint: string) =>
  Object.assign(new Error('dup'), { code: '23505', constraint });

beforeEach(() => vi.resetAllMocks());
afterEach(closeTestApps);

describe('GET /v1/photographers/me', () => {
  it('returns 200 with null when the caller has no photographer profile', async () => {
    vi.mocked(repo.findPhotographer).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/photographers/me', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toBeNull();
  });

  it('returns 200 with the photographer profile', async () => {
    vi.mocked(repo.findPhotographer).mockResolvedValue(PHOTOG);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/photographers/me', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ id: PHOTOG_ID });
    expect(repo.findPhotographer).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/photographers/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when email is not confirmed', async () => {
    const app = await buildTestApp({ id: 'user-1', isVerified: false });
    const res = await app.inject({ method: 'GET', url: '/v1/photographers/me', headers: AUTH });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /v1/photographers/me', () => {
  it('creates the photographer profile (201) when the user has a profile', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(PROFILE);
    vi.mocked(repo.insertPhotographer).mockResolvedValue(PHOTOG);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photographers/me',
      payload: PHOTOG_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ id: PHOTOG_ID });
  });

  it('returns 404 profile_required when the user has no profile', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photographers/me',
      payload: PHOTOG_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('profile_required');
    expect(repo.insertPhotographer).not.toHaveBeenCalled();
  });

  it('returns 409 when a photographer profile already exists', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(PROFILE);
    vi.mocked(repo.insertPhotographer).mockRejectedValue(
      uniqueViolation('photographers_user_id_key'),
    );
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photographers/me',
      payload: PHOTOG_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('already_exists');
  });

  it('returns 400 when genres is empty', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photographers/me',
      payload: { displayName: 'Khai Photo', genres: [] },
      headers: AUTH,
    });
    expect(res.statusCode).toBe(400);
    expect(repo.insertPhotographer).not.toHaveBeenCalled();
  });

  it('returns 400 on an unknown genre', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photographers/me',
      payload: { displayName: 'Khai Photo', genres: ['not_a_genre'] },
      headers: AUTH,
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photographers/me',
      payload: PHOTOG_INPUT,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /v1/photographers/me', () => {
  it('updates the photographer profile (200)', async () => {
    vi.mocked(repo.updatePhotographer).mockResolvedValue({ ...PHOTOG, displayName: 'New Name' });
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/photographers/me',
      payload: { ...PHOTOG_INPUT, displayName: 'New Name' },
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ displayName: 'New Name' });
  });

  it('returns 404 when the photographer profile does not exist', async () => {
    vi.mocked(repo.updatePhotographer).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/photographers/me',
      payload: PHOTOG_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/photographers/me',
      payload: PHOTOG_INPUT,
    });
    expect(res.statusCode).toBe(401);
  });
});
