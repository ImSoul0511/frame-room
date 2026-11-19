import { envSchema, type ApiEnv } from '../config/env.js';
import type { Booking, CreativeProject } from '@frameroom/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { Identity } from '../lib/auth.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';
import * as access from '../services/access.js';
import * as catalog from '../services/catalog.js';

vi.mock('../services/access.js');
vi.mock('../services/catalog.js', async () => {
  const actual =
    await vi.importActual<typeof import('../services/catalog.js')>('../services/catalog.js');
  return {
    ...actual,
    assertProviderOwnership: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock('../services/media.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/media.js')>();
  return {
    ...actual,
    MediaService: vi.fn(function () {
      return {
        url: vi.fn().mockResolvedValue('https://signed.example.com/file'),
        verify: vi.fn(),
      };
    }),
  };
});

const TEST_ENV: ApiEnv = envSchema.parse({
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent',
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgres://localhost:5432/frameroom_test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
});

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_USER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_ID = '55555555-5555-4555-8555-555555555555';
const PHOTOGRAPHER_ID = '66666666-6666-4666-8666-666666666666';
const ADDON_ID = '77777777-7777-4777-8777-777777777777';
const BOOKING_ID = '88888888-8888-4888-8888-888888888888';

const SAMPLE_BOOKING = {
  id: BOOKING_ID,
  clientId: CLIENT_ID,
  projectId: PROJECT_ID,
  serviceId: SERVICE_ID,
  ownerType: 'photographer',
  photographerId: PHOTOGRAPHER_ID,
  studioId: null,
  assignedPhotographerId: PHOTOGRAPHER_ID,
  status: 'pending',
  scheduledStart: '2030-05-10T08:00:00.000Z',
  scheduledEnd: '2030-05-10T10:00:00.000Z',
  totalPrice: 1200,
  serviceName: 'Editorial Portrait',
  serviceSnapshot: {},
  note: '',
  version: 1,
  agreedBriefVersion: null,
  createdAt: '2030-05-01T00:00:00.000Z',
  updatedAt: '2030-05-01T00:00:00.000Z',
} as unknown as Booking;

const SAMPLE_PROJECT = {
  id: PROJECT_ID,
  ownerId: CLIENT_ID,
  title: 'Spring Editorial',
  idea: 'Natural light studio look',
  brief: null,
  referencePaths: [],
  version: 1,
  bookingId: null,
  createdAt: '2030-05-01T00:00:00.000Z',
  updatedAt: '2030-05-01T00:00:00.000Z',
} as unknown as CreativeProject;

const USERS: Record<string, Identity> = {
  'client-token': { id: CLIENT_ID, isVerified: true },
  'provider-token': { id: PROVIDER_USER_ID, isVerified: true },
  'outsider-token': { id: OUTSIDER_ID, isVerified: true },
  'unverified-token': { id: CLIENT_ID, isVerified: false },
};

function createFakeTx() {
  return {
    one: vi.fn(),
    optional: vi.fn(),
    rows: vi.fn(),
    execute: vi.fn().mockResolvedValue(1),
  };
}

function createTestApp(fakeTx = createFakeTx()) {
  const fakeDb: Database = {
    isConfigured: true,
    run: async <T>(_userId: string | null, fn: (tx: Transaction) => Promise<T>) =>
      fn(fakeTx as unknown as Transaction),
    close: async () => undefined,
  };
  const app = buildApp(TEST_ENV, {
    db: fakeDb,
    authenticate: async (header) => {
      const token = header?.replace(/^Bearer\s+/i, '') ?? '';
      const user = USERS[token];
      if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'invalid_token');
      return user;
    },
  });
  return { app, tx: fakeTx };
}

describe('booking routes (105a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.project).mockResolvedValue(SAMPLE_PROJECT);
    vi.mocked(access.booking).mockResolvedValue(SAMPLE_BOOKING);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces authentication and verified email on booking endpoints', async () => {
    const { app } = createTestApp();

    const unauth = await app.inject({ method: 'GET', url: '/v1/bookings' });
    expect(unauth.statusCode).toBe(401);

    const unverified = await app.inject({
      method: 'GET',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer unverified-token' },
    });
    expect(unverified.statusCode).toBe(403);
    await app.close();
  });

  it('creates a booking with snapshotted service/add-ons and bumps project version', async () => {
    const { app, tx } = createTestApp();
    tx.one
      .mockResolvedValueOnce({
        id: SERVICE_ID,
        ownerType: 'photographer',
        photographerId: PHOTOGRAPHER_ID,
        studioId: null,
        name: 'Editorial Portrait',
        price: 1000,
      })
      .mockResolvedValueOnce({ own: false })
      .mockResolvedValueOnce(SAMPLE_BOOKING);
    tx.rows.mockResolvedValueOnce([{ id: ADDON_ID, name: 'Extra Retouch', price: 200 }]);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer client-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-10T10:00:00.000Z',
        addOnIds: [ADDON_ID],
        note: 'Morning light preferred',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data).toEqual(SAMPLE_BOOKING);
    expect(tx.execute).toHaveBeenCalledWith(
      'update creative_projects set version=version+1 where id=$1',
      [PROJECT_ID],
    );
    await app.close();
  });

  it('returns 403 when caller does not own the project and 404 when project is inaccessible', async () => {
    const { app } = createTestApp();

    const nonOwner = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer outsider-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-10T10:00:00.000Z',
      },
    });
    expect(nonOwner.statusCode).toBe(403);

    vi.mocked(access.project).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'not_found'));
    const missingProject = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer outsider-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-10T10:00:00.000Z',
      },
    });
    expect(missingProject.statusCode).toBe(404);
    await app.close();
  });

  it('returns 409 when project is already booked', async () => {
    vi.mocked(access.project).mockResolvedValueOnce({
      ...SAMPLE_PROJECT,
      bookingId: BOOKING_ID,
    } as unknown as CreativeProject);
    const { app } = createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer client-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-10T10:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.details[0]?.reason).toBe('project_already_booked');
    await app.close();
  });

  it('returns 422 on self-booking, invalid add-ons, and intervals over 24 hours', async () => {
    const { app, tx } = createTestApp();

    vi.mocked(access.project).mockResolvedValueOnce({
      ...SAMPLE_PROJECT,
      ownerId: PROVIDER_USER_ID,
    } as unknown as CreativeProject);
    tx.one
      .mockResolvedValueOnce({
        id: SERVICE_ID,
        ownerType: 'photographer',
        photographerId: PHOTOGRAPHER_ID,
        studioId: null,
        name: 'Editorial Portrait',
        price: 1000,
      })
      .mockResolvedValueOnce({ own: true });
    const selfRes = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-10T10:00:00.000Z',
      },
    });
    expect(selfRes.statusCode).toBe(422);
    expect(selfRes.json().error.details[0]?.reason).toBe('self_booking');

    tx.one
      .mockResolvedValueOnce({
        id: SERVICE_ID,
        ownerType: 'photographer',
        photographerId: PHOTOGRAPHER_ID,
        studioId: null,
        name: 'Editorial Portrait',
        price: 1000,
      })
      .mockResolvedValueOnce({ own: false });
    tx.rows.mockResolvedValueOnce([]);
    const addOnRes = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer client-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-10T10:00:00.000Z',
        addOnIds: [ADDON_ID],
      },
    });
    expect(addOnRes.statusCode).toBe(422);
    expect(addOnRes.json().error.details[0]?.reason).toBe('invalid_add_on');

    tx.one
      .mockResolvedValueOnce({
        id: SERVICE_ID,
        ownerType: 'photographer',
        photographerId: PHOTOGRAPHER_ID,
        studioId: null,
        name: 'Editorial Portrait',
        price: 1000,
      })
      .mockResolvedValueOnce({ own: false });
    tx.rows.mockResolvedValueOnce([]);
    const longRes = await app.inject({
      method: 'POST',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer client-token' },
      payload: {
        serviceId: SERVICE_ID,
        projectId: PROJECT_ID,
        scheduledStart: '2030-05-10T08:00:00.000Z',
        scheduledEnd: '2030-05-11T09:00:00.000Z',
      },
    });
    expect(longRes.statusCode).toBe(422);
    expect(longRes.json().error.details[0]?.reason).toBe('invalid_interval');
    await app.close();
  });

  it('lists bookings and returns 404 when reading an unauthorized booking', async () => {
    const { app, tx } = createTestApp();
    tx.rows.mockResolvedValueOnce([SAMPLE_BOOKING]);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/bookings',
      headers: { authorization: 'Bearer client-token' },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data).toEqual([SAMPLE_BOOKING]);

    vi.mocked(access.booking).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'not_found'));
    const detailRes = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}`,
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(detailRes.statusCode).toBe(404);
    await app.close();
  });
});

// --- Slice 105b: Unit tests for transitions, rescheduling, and SQLSTATE error mapping ---
describe('booking transitions and schedule (105b)', () => {
  const RESOURCE_ID = '99999999-9999-4999-8999-999999999999';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions booking status with 200 and forwards positional RPC parameters', async () => {
    const { app, tx } = createTestApp();
    tx.one.mockResolvedValueOnce({
      ...SAMPLE_BOOKING,
      status: 'confirmed',
      version: 2,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        to: 'confirmed',
        version: 1,
        reason: 'Confirmed studio slot',
        assignedPhotographerId: PHOTOGRAPHER_ID,
        resourceIds: [RESOURCE_ID],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('confirmed');
    expect(res.json().data.version).toBe(2);
    expect(tx.one).toHaveBeenCalledWith(
      'select * from public.frameroom_transition($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        BOOKING_ID,
        'confirmed',
        1,
        'Confirmed studio slot',
        null,
        null,
        PHOTOGRAPHER_ID,
        [RESOURCE_ID],
      ],
    );
    await app.close();
  });

  it('reschedules booking with 200 and rejects invalid time intervals with 400', async () => {
    const { app, tx } = createTestApp();

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/v1/bookings/${BOOKING_ID}/schedule`,
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        scheduledStart: '2030-05-11T10:00:00.000Z',
        scheduledEnd: '2030-05-11T08:00:00.000Z',
        version: 2,
      },
    });
    expect(invalid.statusCode).toBe(400);

    tx.one.mockResolvedValueOnce({
      ...SAMPLE_BOOKING,
      status: 'confirmed',
      scheduledStart: '2030-05-11T08:00:00.000Z',
      scheduledEnd: '2030-05-11T10:00:00.000Z',
      version: 3,
    });
    const valid = await app.inject({
      method: 'PATCH',
      url: `/v1/bookings/${BOOKING_ID}/schedule`,
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        scheduledStart: '2030-05-11T08:00:00.000Z',
        scheduledEnd: '2030-05-11T10:00:00.000Z',
        assignedPhotographerId: PHOTOGRAPHER_ID,
        resourceIds: [RESOURCE_ID],
        version: 2,
      },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().data.version).toBe(3);
    expect(tx.one).toHaveBeenCalledWith(
      'select * from public.frameroom_reschedule($1,$2,$3,$4,$5,$6)',
      [
        BOOKING_ID,
        2,
        '2030-05-11T08:00:00.000Z',
        '2030-05-11T10:00:00.000Z',
        PHOTOGRAPHER_ID,
        [RESOURCE_ID],
      ],
    );
    await app.close();
  });

  it('maps Postgres RPC SQLSTATE errors to stable HTTP statuses and reasons', async () => {
    const { app, tx } = createTestApp();

    tx.one.mockRejectedValueOnce({ code: '40001' });
    const stale = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: { to: 'confirmed', version: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.details[0]?.reason).toBe('stale_version');

    tx.one.mockRejectedValueOnce({ code: '23P01' });
    const overlap = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: { to: 'confirmed', version: 1 },
    });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json().error.details[0]?.reason).toBe('slot_overlap');

    tx.one.mockRejectedValueOnce({ code: '23514', message: 'brief_required' });
    const briefReq = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: { to: 'in_progress', version: 2 },
    });
    expect(briefReq.statusCode).toBe(422);
    expect(briefReq.json().error.details[0]?.reason).toBe('brief_required');

    tx.one.mockRejectedValueOnce({ code: '42501' });
    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/v1/bookings/${BOOKING_ID}/schedule`,
      headers: { authorization: 'Bearer outsider-token' },
      payload: {
        scheduledStart: '2030-05-11T08:00:00.000Z',
        scheduledEnd: '2030-05-11T10:00:00.000Z',
        version: 2,
      },
    });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });
});

// --- Slice 105c: Unit tests for brief versioning, approval, and locking rules ---
describe('brief versions and approval (105c)', () => {
  const BRIEF_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const SAMPLE_BRIEF = {
    id: BRIEF_ID,
    bookingId: BOOKING_ID,
    version: 1,
    content: {
      title: 'Spring Editorial Brief',
      concept: 'Natural light portrait',
      shotList: ['Half body'],
      lighting: ['Window light'],
      checklist: ['50mm lens'],
      milestones: ['Moodboard'],
    },
    createdBy: CLIENT_ID,
    clientApproved: true,
    providerApproved: false,
    createdAt: '2030-05-02T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.booking).mockResolvedValue({
      ...SAMPLE_BOOKING,
      status: 'confirmed',
    } as unknown as Booking);
  });

  it('creates a brief version with 201 and bumps agreed_brief_version once both sides approve', async () => {
    const { app, tx } = createTestApp();
    tx.one.mockResolvedValueOnce(SAMPLE_BRIEF);

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions`,
      headers: { authorization: 'Bearer client-token' },
      payload: SAMPLE_BRIEF.content,
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().data).toEqual(SAMPLE_BRIEF);

    tx.one
      .mockResolvedValueOnce({ ...SAMPLE_BRIEF, latestVersion: 1, status: 'open' })
      .mockResolvedValueOnce({
        ...SAMPLE_BRIEF,
        providerApproved: true,
      });
    const approveRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions/${BRIEF_ID}/approve`,
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().data.providerApproved).toBe(true);
    expect(tx.execute).toHaveBeenCalledWith(
      'update bookings set agreed_brief_version=$2,version=version+1 where id=$1',
      [BOOKING_ID, 1],
    );
    await app.close();
  });

  it('rejects brief mutation when booking is locked (422) or brief version is stale (409)', async () => {
    const { app, tx } = createTestApp();

    vi.mocked(access.booking).mockResolvedValueOnce({
      ...SAMPLE_BOOKING,
      status: 'proofing',
    } as unknown as Booking);
    const lockedRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions`,
      headers: { authorization: 'Bearer client-token' },
      payload: SAMPLE_BRIEF.content,
    });
    expect(lockedRes.statusCode).toBe(422);
    expect(lockedRes.json().error.details[0]?.reason).toBe('brief_locked');

    vi.mocked(access.booking).mockResolvedValueOnce({
      ...SAMPLE_BOOKING,
      status: 'confirmed',
      agreedBriefVersion: 2,
    } as unknown as Booking);
    tx.one.mockResolvedValueOnce(SAMPLE_BRIEF);
    const staleRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions/${BRIEF_ID}/approve`,
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(staleRes.statusCode).toBe(409);
    expect(staleRes.json().error.details[0]?.reason).toBe('stale_brief');
    await app.close();
  });
});

// --- Slice 105d: Unit tests for workspace projection and role-based visibility ---
describe('booking workspace (105d)', () => {
  const SAMPLE_DELIVERY = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    bookingId: BOOKING_ID,
    storagePath: 'deliveries/final.zip',
    fileName: 'final.zip',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.booking).mockResolvedValue({
      ...SAMPLE_BOOKING,
      status: 'proofing',
      agreedBriefVersion: 1,
    } as unknown as Booking);
  });

  it('returns the full workspace with signed delivery URLs for providers', async () => {
    const { app, tx } = createTestApp();
    tx.one
      .mockResolvedValueOnce(SAMPLE_PROJECT)
      .mockResolvedValueOnce({ value: true })
      .mockResolvedValueOnce({ value: true });
    tx.optional.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    tx.rows
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([SAMPLE_DELIVERY])
      .mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}/workspace`,
      headers: { authorization: 'Bearer provider-token' },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.isProvider).toBe(true);
    expect(data.deliveries).toEqual([
      { ...SAMPLE_DELIVERY, url: 'https://signed.example.com/file' },
    ]);
    await app.close();
  });

  it('hides pre-delivery files from clients until delivered', async () => {
    const { app, tx } = createTestApp();
    tx.one
      .mockResolvedValueOnce(SAMPLE_PROJECT)
      .mockResolvedValueOnce({ value: false })
      .mockResolvedValueOnce({ value: false });
    tx.optional.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    tx.rows.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const proofingRes = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}/workspace`,
      headers: { authorization: 'Bearer client-token' },
    });
    expect(proofingRes.statusCode).toBe(200);
    expect(proofingRes.json().data.isClient).toBe(true);
    expect(proofingRes.json().data.deliveries).toEqual([]);
    await app.close();
  });

  it('returns 404 when caller is not a booking participant', async () => {
    vi.mocked(access.booking).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'not_found'));
    const { app } = createTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}/workspace`,
      headers: { authorization: 'Bearer outsider-token' },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

// --- Slice 105e: Unit tests for personal and resource schedule management ---
describe('personal and resource schedule (105e)', () => {
  const STUDIO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const RESOURCE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const ENTRY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  const SAMPLE_BLOCK = {
    id: ENTRY_ID,
    bookingId: null,
    photographerId: PHOTOGRAPHER_ID,
    resourceId: null,
    label: 'Personal time off',
    startsAt: '2030-05-15T08:00:00.000Z',
    endsAt: '2030-05-15T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.manager).mockResolvedValue(undefined);
  });

  it('lists personal and resource schedule entries with 200', async () => {
    const { app, tx } = createTestApp();
    tx.rows.mockResolvedValueOnce([SAMPLE_BLOCK]);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/schedule',
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([SAMPLE_BLOCK]);
    await app.close();
  });

  it('creates schedule blocks for owned photographers and managed studio resources (201) and maps overlap (409)', async () => {
    const { app, tx } = createTestApp();

    tx.one.mockResolvedValueOnce({ id: PHOTOGRAPHER_ID }).mockResolvedValueOnce(SAMPLE_BLOCK);
    const photoBlock = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        label: 'Personal time off',
        startsAt: '2030-05-15T08:00:00.000Z',
        endsAt: '2030-05-15T12:00:00.000Z',
      },
    });
    expect(photoBlock.statusCode).toBe(201);

    tx.one
      .mockResolvedValueOnce({ studioId: STUDIO_ID })
      .mockResolvedValueOnce({ ...SAMPLE_BLOCK, photographerId: null, resourceId: RESOURCE_ID });
    const resourceBlock = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        resourceId: RESOURCE_ID,
        label: 'Cyclorama repaint',
        startsAt: '2030-05-15T08:00:00.000Z',
        endsAt: '2030-05-15T12:00:00.000Z',
      },
    });
    expect(resourceBlock.statusCode).toBe(201);
    expect(access.manager).toHaveBeenCalledWith(expect.anything(), STUDIO_ID);

    tx.one.mockResolvedValueOnce({ id: PHOTOGRAPHER_ID }).mockRejectedValueOnce({ code: '23P01' });
    const overlap = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        label: 'Overlapping block',
        startsAt: '2030-05-15T09:00:00.000Z',
        endsAt: '2030-05-15T11:00:00.000Z',
      },
    });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json().error.details[0]?.reason).toBe('slot_overlap');
    await app.close();
  });

  it('deletes manual schedule blocks with 204 empty body and rejects booking reservations with 422', async () => {
    const { app, tx } = createTestApp();
    tx.one.mockResolvedValueOnce({
      photographerId: PHOTOGRAPHER_ID,
      resourceId: null,
      bookingId: null,
    });

    const delOk = await app.inject({
      method: 'DELETE',
      url: `/v1/me/schedule/blocks/${ENTRY_ID}`,
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(delOk.statusCode).toBe(204);
    expect(delOk.body).toBe('');
    expect(catalog.assertProviderOwnership).toHaveBeenCalledWith(
      expect.anything(),
      PROVIDER_USER_ID,
      { photographerId: PHOTOGRAPHER_ID, studioId: null },
    );
    expect(tx.execute).toHaveBeenCalledWith('delete from schedule_entries where id=$1', [ENTRY_ID]);

    tx.one.mockResolvedValueOnce({
      photographerId: PHOTOGRAPHER_ID,
      resourceId: null,
      bookingId: BOOKING_ID,
    });
    const delBooking = await app.inject({
      method: 'DELETE',
      url: `/v1/me/schedule/blocks/${ENTRY_ID}`,
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(delBooking.statusCode).toBe(422);
    expect(delBooking.json().error.details[0]?.reason).toBe('booking_reservation');
    await app.close();
  });
});
