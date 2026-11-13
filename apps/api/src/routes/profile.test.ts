import type { Profile } from '@frameroom/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH, bodyData, buildTestApp, closeTestApps } from '../../test/helpers/build-test-app.js';
import * as repo from '../repositories/profiles.js';

vi.mock('../repositories/profiles.js');

// Khớp profileInputSchema / profileSchema (id phải là UUID, có roles và createdAt).
const PROFILE_INPUT = { userName: 'khai', displayName: 'Khai' };
const PROFILE: Profile = {
  id: '11111111-1111-4111-8111-111111111111',
  ...PROFILE_INPUT,
  roles: ['client'],
  createdAt: '2026-11-13T00:00:00.000Z',
};

// Giá trị mock "không có / không cập nhật được" mà không dùng any.
const NONE = undefined as never;
const UPDATED = true as never;
const NOT_UPDATED = false as never;

const uniqueViolation = (constraint: string) =>
  Object.assign(new Error('dup'), { code: '23505', constraint });

beforeEach(() => vi.resetAllMocks());
afterEach(closeTestApps);

describe('GET /v1/me', () => {
  it('returns 200 with the caller profile', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(PROFILE);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ userName: 'khai' });
    expect(repo.findProfile).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('returns 404 profile_required when profile is missing', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(NONE);
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: AUTH });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('profile_required');
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain('authentication_required');
  });

  it('returns 403 when email is not confirmed', async () => {
    const app = await buildTestApp({ id: 'user-1', isVerified: false });
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: AUTH });
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('email_confirmation_required');
  });
});

describe('POST /v1/me', () => {
  it('creates the profile on first call (201)', async () => {
    vi.mocked(repo.findProfile)
      .mockResolvedValueOnce(NONE) // chưa có
      .mockResolvedValueOnce(PROFILE); // đọc lại sau khi insert
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me',
      payload: PROFILE_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(201);
    expect(bodyData(res)).toMatchObject({ userName: 'khai' });
    expect(repo.lockUser).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(repo.insertProfile).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with the existing profile on retry and does not insert again', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(PROFILE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me',
      payload: { userName: 'other', displayName: 'Other' },
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ userName: 'khai' }); // input mới bị bỏ qua
    expect(repo.insertProfile).not.toHaveBeenCalled();
  });

  it('returns 409 user_name_taken on unique violation', async () => {
    vi.mocked(repo.findProfile).mockResolvedValue(NONE);
    vi.mocked(repo.insertProfile).mockRejectedValue(uniqueViolation('profiles_user_name_key'));
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/me',
      payload: PROFILE_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('user_name_taken');
  });

  it('returns 400 on invalid payload', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/v1/me', payload: {}, headers: AUTH });
    expect(res.statusCode).toBe(400);
    expect(repo.insertProfile).not.toHaveBeenCalled();
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/v1/me', payload: PROFILE_INPUT });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /v1/me', () => {
  it('updates the profile (200)', async () => {
    vi.mocked(repo.updateProfile).mockResolvedValue(UPDATED);
    vi.mocked(repo.findProfile).mockResolvedValue({ ...PROFILE, displayName: 'Khai Updated' });
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      payload: { ...PROFILE_INPUT, displayName: 'Khai Updated' },
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(bodyData(res)).toMatchObject({ displayName: 'Khai Updated' });
  });

  it('returns 404 profile_required when profile does not exist', async () => {
    vi.mocked(repo.updateProfile).mockResolvedValue(NOT_UPDATED);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      payload: PROFILE_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('profile_required');
  });

  it('returns 409 user_name_taken on unique violation', async () => {
    vi.mocked(repo.updateProfile).mockRejectedValue(uniqueViolation('profiles_user_name_key'));
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      payload: PROFILE_INPUT,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('user_name_taken');
  });

  it('returns 401 without authorization header', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'PATCH', url: '/v1/me', payload: PROFILE_INPUT });
    expect(res.statusCode).toBe(401);
  });
});
