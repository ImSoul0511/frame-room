import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { ApiEnv } from '../config/env.js';
import type { Identity } from '../lib/auth.js';
import { ApiError } from '../lib/errors.js';
import * as bookingRepo from '../repositories/bookings.js';
import type { Database, Transaction } from '../repositories/database.js';
import type { Booking } from '../schemas/bookings.js';
import * as access from '../services/access.js';

vi.mock('../repositories/bookings.js');
vi.mock('../services/access.js');

const TEST_ENV: ApiEnv = {
  HOST: '127.0.0.1',
  PORT: 3001,
  LOG_LEVEL: 'silent',
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgres://localhost:5432/frameroom_test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_USER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_ID = '55555555-5555-4555-8555-555555555555';
const PHOTOGRAPHER_ID = '66666666-6666-4666-8666-666666666666';
const ADDON_ID = '77777777-7777-4777-8777-777777777777';
const BOOKING_ID = '88888888-8888-4888-8888-888888888888';

const SAMPLE_BOOKING: Booking = {
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
  version: 1,
  agreedBriefVersion: null,
  createdAt: '2030-05-01T00:00:00.000Z',
  updatedAt: '2030-05-01T00:00:00.000Z',
};

const USERS: Record<string, Identity> = {
  'client-token': { id: CLIENT_ID, isVerified: true },
  'provider-token': { id: PROVIDER_USER_ID, isVerified: true },
  'outsider-token': { id: OUTSIDER_ID, isVerified: true },
  'unverified-token': { id: CLIENT_ID, isVerified: false },
};

function createTestApp() {
  const fakeTx = {} as Transaction;
  const fakeDb: Database = {
    isConfigured: true,
    run: async <T>(_userId: string | null, fn: (tx: Transaction) => Promise<T>) => fn(fakeTx),
    close: async () => undefined,
  };
  return buildApp(TEST_ENV, {
    db: fakeDb,
    authenticate: async (header) => {
      const token = header?.replace(/^Bearer\s+/i, '') ?? '';
      const user = USERS[token];
      if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'invalid_token');
      return user;
    },
  });
}

describe('booking routes (105a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.project).mockResolvedValue({
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
    });
    vi.mocked(access.booking).mockResolvedValue(SAMPLE_BOOKING);
    vi.mocked(bookingRepo.findBookableService).mockResolvedValue({
      id: SERVICE_ID,
      ownerType: 'photographer',
      photographerId: PHOTOGRAPHER_ID,
      studioId: null,
      name: 'Editorial Portrait',
      description: 'Natural light session',
      genre: 'portrait',
      durationMinutes: 120,
      price: 1000,
      photoCount: 20,
      retouchedCount: 10,
    });
    vi.mocked(bookingRepo.isSelfProvider).mockResolvedValue(false);
    vi.mocked(bookingRepo.findActiveServiceAddOns).mockResolvedValue([
      { id: ADDON_ID, name: 'Extra Retouch', price: 200 },
    ]);
    vi.mocked(bookingRepo.insertBooking).mockResolvedValue(SAMPLE_BOOKING);
    vi.mocked(bookingRepo.incrementProjectVersion).mockResolvedValue(undefined);
    vi.mocked(bookingRepo.listReadableBookings).mockResolvedValue([SAMPLE_BOOKING]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces authentication and verified email on booking endpoints', async () => {
    const app = createTestApp();

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
    const app = createTestApp();
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
    expect(bookingRepo.insertBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        serviceId: SERVICE_ID,
        totalPrice: 1200,
        serviceSnapshot: expect.objectContaining({
          id: SERVICE_ID,
          price: 1000,
          addOns: [{ id: ADDON_ID, name: 'Extra Retouch', price: 200 }],
        }),
      }),
    );
    expect(bookingRepo.incrementProjectVersion).toHaveBeenCalledWith(expect.anything(), PROJECT_ID);
    await app.close();
  });

  it('returns 403 when caller does not own the project and 404 when project is inaccessible', async () => {
    const app = createTestApp();

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
      id: PROJECT_ID,
      ownerId: CLIENT_ID,
      title: 'Spring Editorial',
      idea: 'Natural light studio look',
      brief: null,
      referencePaths: [],
      version: 1,
      bookingId: BOOKING_ID,
      createdAt: '2030-05-01T00:00:00.000Z',
      updatedAt: '2030-05-01T00:00:00.000Z',
    });
    const app = createTestApp();
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

  it('returns 404 when service is missing or provider is hidden', async () => {
    vi.mocked(bookingRepo.findBookableService).mockResolvedValueOnce(undefined);
    const app = createTestApp();
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

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('returns 422 on self-booking, invalid add-ons, and intervals over 24 hours', async () => {
    const app = createTestApp();

    vi.mocked(bookingRepo.isSelfProvider).mockResolvedValueOnce(true);
    vi.mocked(access.project).mockResolvedValueOnce({
      id: PROJECT_ID,
      ownerId: PROVIDER_USER_ID,
      bookingId: null,
      title: 'Spring Editorial',
      idea: 'Natural light',
      brief: null,
      referencePaths: [],
      version: 1,
      createdAt: '2030-05-01T00:00:00.000Z',
      updatedAt: '2030-05-01T00:00:00.000Z',
    });
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

    vi.mocked(bookingRepo.findActiveServiceAddOns).mockResolvedValueOnce([]);
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

    vi.mocked(bookingRepo.findActiveServiceAddOns).mockResolvedValueOnce([]);
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
    const app = createTestApp();

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
    vi.mocked(bookingRepo.callTransitionBooking).mockResolvedValue({
      ...SAMPLE_BOOKING,
      status: 'confirmed',
      version: 2,
    });
    vi.mocked(bookingRepo.callRescheduleBooking).mockResolvedValue({
      ...SAMPLE_BOOKING,
      status: 'confirmed',
      scheduledStart: '2030-05-11T08:00:00.000Z',
      scheduledEnd: '2030-05-11T10:00:00.000Z',
      version: 3,
    });
  });

  it('transitions booking status with 200 and forwards positional RPC parameters', async () => {
    const app = createTestApp();
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
    expect(bookingRepo.callTransitionBooking).toHaveBeenCalledWith(expect.anything(), BOOKING_ID, {
      to: 'confirmed',
      version: 1,
      reason: 'Confirmed studio slot',
      assignedPhotographerId: PHOTOGRAPHER_ID,
      resourceIds: [RESOURCE_ID],
    });
    await app.close();
  });

  it('reschedules booking with 200 and rejects invalid time intervals with 400', async () => {
    const app = createTestApp();

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
    expect(bookingRepo.callRescheduleBooking).toHaveBeenCalledWith(expect.anything(), BOOKING_ID, {
      scheduledStart: '2030-05-11T08:00:00.000Z',
      scheduledEnd: '2030-05-11T10:00:00.000Z',
      assignedPhotographerId: PHOTOGRAPHER_ID,
      resourceIds: [RESOURCE_ID],
      version: 2,
    });
    await app.close();
  });

  it('maps Postgres RPC SQLSTATE errors to stable HTTP statuses and reasons', async () => {
    const app = createTestApp();

    vi.mocked(bookingRepo.callTransitionBooking).mockRejectedValueOnce({ code: '40001' });
    const stale = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: { to: 'confirmed', version: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.details[0]?.reason).toBe('stale_version');

    vi.mocked(bookingRepo.callTransitionBooking).mockRejectedValueOnce({ code: '23P01' });
    const overlap = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: { to: 'confirmed', version: 1 },
    });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json().error.details[0]?.reason).toBe('slot_overlap');

    vi.mocked(bookingRepo.callTransitionBooking).mockRejectedValueOnce({
      code: '23514',
      message: 'brief_required',
    });
    const briefReq = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/transitions`,
      headers: { authorization: 'Bearer provider-token' },
      payload: { to: 'in_progress', version: 2 },
    });
    expect(briefReq.statusCode).toBe(422);
    expect(briefReq.json().error.details[0]?.reason).toBe('brief_required');

    vi.mocked(bookingRepo.callRescheduleBooking).mockRejectedValueOnce({ code: '42501' });
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
    });
    vi.mocked(access.providerSide).mockResolvedValue(undefined);
    vi.mocked(bookingRepo.insertBriefVersion).mockResolvedValue(SAMPLE_BRIEF);
    vi.mocked(bookingRepo.findBriefVersionForUpdate).mockResolvedValue(SAMPLE_BRIEF);
    vi.mocked(bookingRepo.approveBriefSide).mockResolvedValue({
      ...SAMPLE_BRIEF,
      providerApproved: true,
    });
    vi.mocked(bookingRepo.setAgreedBriefVersion).mockResolvedValue(undefined);
  });

  it('creates a brief version with 201 and bumps agreed_brief_version once both sides approve', async () => {
    const app = createTestApp();

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions`,
      headers: { authorization: 'Bearer client-token' },
      payload: SAMPLE_BRIEF.content,
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().data).toEqual(SAMPLE_BRIEF);
    expect(bookingRepo.insertBriefVersion).toHaveBeenCalledWith(
      expect.anything(),
      BOOKING_ID,
      CLIENT_ID,
      SAMPLE_BRIEF.content,
      true,
    );

    const approveRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions/${BRIEF_ID}/approve`,
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().data.providerApproved).toBe(true);
    expect(bookingRepo.setAgreedBriefVersion).toHaveBeenCalledWith(
      expect.anything(),
      BOOKING_ID,
      1,
    );
    await app.close();
  });

  it('rejects non-provider participants on provider-side approval with 403', async () => {
    vi.mocked(access.providerSide).mockRejectedValueOnce(
      new ApiError(403, 'FORBIDDEN', 'forbidden'),
    );
    const app = createTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/brief-versions/${BRIEF_ID}/approve`,
      headers: { authorization: 'Bearer outsider-token' },
    });

    expect(res.statusCode).toBe(403);
    expect(bookingRepo.approveBriefSide).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects brief mutation when booking is locked (422) or brief version is stale (409)', async () => {
    const app = createTestApp();

    vi.mocked(access.booking).mockResolvedValueOnce({
      ...SAMPLE_BOOKING,
      status: 'proofing',
    });
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
    });
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
  const SAMPLE_PROJECT = {
    id: PROJECT_ID,
    ownerId: CLIENT_ID,
    title: 'Spring Editorial',
    idea: 'Natural light studio look',
    brief: null,
    referencePaths: [],
    version: 1,
    bookingId: BOOKING_ID,
    createdAt: '2030-05-01T00:00:00.000Z',
    updatedAt: '2030-05-01T00:00:00.000Z',
  };

  const SAMPLE_PROVIDER = {
    ownerType: 'photographer' as const,
    id: PHOTOGRAPHER_ID,
    displayName: 'Linh Nguyen',
    avatarPath: null,
    city: 'Ho Chi Minh City',
  };

  const SAMPLE_AGREED_BRIEF = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
    providerApproved: true,
    createdAt: '2030-05-02T00:00:00.000Z',
  };

  const SAMPLE_DELIVERY = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    bookingId: BOOKING_ID,
    storagePath: 'deliveries/final.zip',
    url: null,
    fileName: 'final.zip',
    mimeType: 'application/zip',
    sizeBytes: 1024,
    note: 'Final retouched set',
    uploadedBy: PROVIDER_USER_ID,
    createdAt: '2030-05-12T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.booking).mockResolvedValue({
      ...SAMPLE_BOOKING,
      status: 'proofing',
      agreedBriefVersion: 1,
    });
    vi.mocked(access.providerSide).mockResolvedValue(undefined);
    vi.mocked(bookingRepo.findBookingProject).mockResolvedValue(SAMPLE_PROJECT);
    vi.mocked(bookingRepo.findBookingProvider).mockResolvedValue(SAMPLE_PROVIDER);
    vi.mocked(bookingRepo.findAssignedPhotographer).mockResolvedValue({
      id: PHOTOGRAPHER_ID,
      userId: PROVIDER_USER_ID,
      displayName: 'Linh Nguyen',
      avatarPath: null,
    });
    vi.mocked(bookingRepo.listBookingResources).mockResolvedValue([]);
    vi.mocked(bookingRepo.listBriefVersions).mockResolvedValue([SAMPLE_AGREED_BRIEF]);
    vi.mocked(bookingRepo.listBookingMessages).mockResolvedValue([]);
    vi.mocked(bookingRepo.listBookingDecisions).mockResolvedValue([]);
    vi.mocked(bookingRepo.listBookingMilestones).mockResolvedValue([]);
    vi.mocked(bookingRepo.listBookingGalleries).mockResolvedValue([]);
    vi.mocked(bookingRepo.listBookingDeliveries).mockResolvedValue([SAMPLE_DELIVERY]);
    vi.mocked(bookingRepo.findBookingReview).mockResolvedValue(null);
  });

  it('returns the full 13-part workspace with draft galleries and deliveries for providers', async () => {
    const app = createTestApp();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}/workspace`,
      headers: { authorization: 'Bearer provider-token' },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(Object.keys(data)).toEqual([
      'booking',
      'project',
      'provider',
      'assignedPhotographer',
      'resources',
      'briefVersions',
      'agreedBrief',
      'messages',
      'decisions',
      'milestones',
      'galleries',
      'deliveries',
      'review',
    ]);
    expect(data.agreedBrief).toEqual(SAMPLE_AGREED_BRIEF);
    expect(data.deliveries).toEqual([SAMPLE_DELIVERY]);
    expect(bookingRepo.listBookingGalleries).toHaveBeenCalledWith(
      expect.anything(),
      BOOKING_ID,
      true,
    );
    await app.close();
  });

  it('hides draft galleries and pre-delivery files from clients until delivered', async () => {
    const app = createTestApp();

    const proofingRes = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}/workspace`,
      headers: { authorization: 'Bearer client-token' },
    });
    expect(proofingRes.statusCode).toBe(200);
    expect(proofingRes.json().data.deliveries).toEqual([]);
    expect(bookingRepo.listBookingGalleries).toHaveBeenCalledWith(
      expect.anything(),
      BOOKING_ID,
      false,
    );
    expect(bookingRepo.listBookingDeliveries).not.toHaveBeenCalled();

    vi.mocked(access.booking).mockResolvedValueOnce({
      ...SAMPLE_BOOKING,
      status: 'delivered',
      agreedBriefVersion: 1,
    });
    const deliveredRes = await app.inject({
      method: 'GET',
      url: `/v1/bookings/${BOOKING_ID}/workspace`,
      headers: { authorization: 'Bearer client-token' },
    });
    expect(deliveredRes.statusCode).toBe(200);
    expect(deliveredRes.json().data.deliveries).toEqual([SAMPLE_DELIVERY]);
    await app.close();
  });

  it('returns 404 when caller is not a booking participant', async () => {
    vi.mocked(access.booking).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'not_found'));
    const app = createTestApp();

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
    kind: 'blocked' as const,
    title: 'Personal time off',
    startsAt: '2030-05-15T08:00:00.000Z',
    endsAt: '2030-05-15T12:00:00.000Z',
    createdBy: PROVIDER_USER_ID,
    createdAt: '2030-05-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access.manageProvider).mockResolvedValue(undefined);
    vi.mocked(bookingRepo.listPersonalSchedule).mockResolvedValue([SAMPLE_BLOCK]);
    vi.mocked(bookingRepo.findResourceStudioId).mockResolvedValue(STUDIO_ID);
    vi.mocked(bookingRepo.insertScheduleBlock).mockResolvedValue(SAMPLE_BLOCK);
    vi.mocked(bookingRepo.findScheduleEntryForDelete).mockResolvedValue({
      ...SAMPLE_BLOCK,
      resourceStudioId: null,
    });
    vi.mocked(bookingRepo.deleteScheduleEntry).mockResolvedValue(undefined);
  });

  it('lists personal/resource schedule entries with 200 and validates date range', async () => {
    const app = createTestApp();

    const badQuery = await app.inject({
      method: 'GET',
      url: '/v1/me/schedule?from=2030-05-16T00:00:00.000Z&to=2030-05-15T00:00:00.000Z',
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(badQuery.statusCode).toBe(400);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/schedule?from=2030-05-15T00:00:00.000Z&to=2030-05-16T00:00:00.000Z',
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([SAMPLE_BLOCK]);
    expect(bookingRepo.listPersonalSchedule).toHaveBeenCalledWith(expect.anything(), {
      from: '2030-05-15T00:00:00.000Z',
      to: '2030-05-16T00:00:00.000Z',
    });
    await app.close();
  });

  it('creates schedule blocks for owned photographers and managed studio resources (201) and maps overlap (409)', async () => {
    const app = createTestApp();

    const missingTarget = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        title: 'Invalid target',
        startsAt: '2030-05-15T08:00:00.000Z',
        endsAt: '2030-05-15T12:00:00.000Z',
      },
    });
    expect(missingTarget.statusCode).toBe(400);

    const photoBlock = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        photographerId: PHOTOGRAPHER_ID,
        title: 'Personal time off',
        startsAt: '2030-05-15T08:00:00.000Z',
        endsAt: '2030-05-15T12:00:00.000Z',
      },
    });
    expect(photoBlock.statusCode).toBe(201);
    expect(access.manageProvider).toHaveBeenCalledWith(expect.anything(), PHOTOGRAPHER_ID, null);

    vi.mocked(bookingRepo.insertScheduleBlock).mockResolvedValueOnce({
      ...SAMPLE_BLOCK,
      photographerId: null,
      resourceId: RESOURCE_ID,
      kind: 'maintenance',
    });
    const resourceBlock = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        resourceId: RESOURCE_ID,
        kind: 'maintenance',
        title: 'Cyclorama repaint',
        startsAt: '2030-05-15T08:00:00.000Z',
        endsAt: '2030-05-15T12:00:00.000Z',
      },
    });
    expect(resourceBlock.statusCode).toBe(201);
    expect(access.manageProvider).toHaveBeenCalledWith(expect.anything(), null, STUDIO_ID);

    vi.mocked(bookingRepo.insertScheduleBlock).mockRejectedValueOnce({ code: '23P01' });
    const overlap = await app.inject({
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      headers: { authorization: 'Bearer provider-token' },
      payload: {
        photographerId: PHOTOGRAPHER_ID,
        title: 'Overlapping block',
        startsAt: '2030-05-15T09:00:00.000Z',
        endsAt: '2030-05-15T11:00:00.000Z',
      },
    });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json().error.details[0]?.reason).toBe('slot_overlap');
    await app.close();
  });

  it('deletes manual schedule blocks with 204 empty body and rejects booking reservations with 422', async () => {
    const app = createTestApp();

    const delOk = await app.inject({
      method: 'DELETE',
      url: `/v1/me/schedule/blocks/${ENTRY_ID}`,
      headers: { authorization: 'Bearer provider-token' },
    });
    expect(delOk.statusCode).toBe(204);
    expect(delOk.body).toBe('');
    expect(bookingRepo.deleteScheduleEntry).toHaveBeenCalledWith(expect.anything(), ENTRY_ID);

    vi.mocked(bookingRepo.findScheduleEntryForDelete).mockResolvedValueOnce({
      ...SAMPLE_BLOCK,
      bookingId: BOOKING_ID,
      kind: 'booking',
      resourceStudioId: null,
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
