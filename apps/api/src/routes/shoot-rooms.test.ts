import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMock = vi.fn();
const urlMock = vi.fn().mockResolvedValue('https://signed.example.com/file');

vi.mock('../services/media.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/media.js')>();
  return {
    ...actual,
    MediaService: vi.fn(function () {
      return {
        url: urlMock,
        verify: verifyMock,
      };
    }),
  };
});

import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';
const ROOM_ID = '55555555-5555-4555-8555-555555555555';
const MILESTONE_ID = '66666666-6666-4666-8666-666666666666';
const DECISION_ID = '77777777-7777-4777-8777-777777777777';
const GALLERY_ID = '88888888-8888-4888-8888-888888888888';
const IMAGE_1_ID = '99999999-9999-4999-8999-999999999991';
const IMAGE_2_ID = '99999999-9999-4999-8999-999999999992';
const PHOTOGRAPHER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type QueryResponse =
  | { kind: 'one'; value: unknown }
  | { kind: 'optional'; value: unknown }
  | { kind: 'rows'; value: unknown[] }
  | { kind: 'execute'; value?: number }
  | { kind: 'throw'; error: unknown };

const queue: QueryResponse[] = [];
const executedSql: Array<{ sql: string; params?: unknown[] }> = [];

function nextResponse(kind: string, sql: string, params?: unknown[]) {
  executedSql.push({ sql, params });
  const item = queue.shift();
  if (!item) {
    throw new Error(`Unexpected ${kind} query with empty mock queue: ${sql}`);
  }
  if (item.kind === 'throw') {
    throw item.error;
  }
  if (item.kind !== kind) {
    throw new Error(`Expected query kind ${item.kind} but got ${kind} for SQL: ${sql}`);
  }
  return item.value;
}

const mockTx = {
  one: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('one', sql, params)),
  optional: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('optional', sql, params)),
  rows: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('rows', sql, params)),
  execute: vi.fn(async (sql: string, params?: unknown[]) => nextResponse('execute', sql, params)),
} as unknown as Transaction;

const mockDb: Database = {
  isConfigured: true,
  async run(_userId, action) {
    return action(mockTx);
  },
  async close() {},
};

const apps: ReturnType<typeof buildApp>[] = [];

function createTestApp() {
  const app = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }), {
    db: mockDb,
    authenticate: async (header) => {
      if (header === 'Bearer client') return { id: CLIENT_ID, isVerified: true };
      if (header === 'Bearer provider') return { id: PROVIDER_ID, isVerified: true };
      if (header === 'Bearer outsider') return { id: OUTSIDER_ID, isVerified: true };
      throw new ApiError(401, 'UNAUTHORIZED', 'invalid_session');
    },
  });
  apps.push(app);
  return app;
}

function sampleBooking(status = 'in_progress') {
  return {
    id: BOOKING_ID,
    clientId: CLIENT_ID,
    projectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    serviceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ownerType: 'photographer',
    photographerId: PHOTOGRAPHER_ID,
    studioId: null,
    assignedPhotographerId: PHOTOGRAPHER_ID,
    status,
    scheduledStart: '2026-11-22T09:00:00.000Z',
    scheduledEnd: '2026-11-22T12:00:00.000Z',
    totalPrice: 2500000,
    serviceName: 'Editorial Portrait',
    version: 2,
    agreedBriefVersion: 1,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
  };
}

beforeEach(() => {
  queue.length = 0;
  executedSql.length = 0;
  verifyMock.mockReset();
  urlMock.mockClear();
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('shoot room collaboration (106a)', () => {
  it('posts a text message and an image attachment message in an open room', async () => {
    const app = createTestApp();

    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      {
        kind: 'one',
        value: {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          roomId: ROOM_ID,
          senderId: CLIENT_ID,
          text: 'Confirmed call time at 8:45 AM.',
          storagePath: null,
          type: 'text',
        },
      },
    );

    const textRes = await app.inject({
      method: 'POST',
      url: `/v1/shoot-rooms/${ROOM_ID}/messages`,
      headers: { authorization: 'Bearer client' },
      payload: { text: 'Confirmed call time at 8:45 AM.' },
    });
    expect(textRes.statusCode).toBe(201);
    expect(textRes.json().data.type).toBe('text');

    verifyMock.mockResolvedValueOnce({
      width: 1200,
      height: 800,
      mimeType: 'image/jpeg',
    });
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      {
        kind: 'one',
        value: {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          roomId: ROOM_ID,
          senderId: PROVIDER_ID,
          text: 'Lighting diagram',
          storagePath: `${ROOM_ID}/diagram.jpg`,
          type: 'image',
        },
      },
    );

    const imgRes = await app.inject({
      method: 'POST',
      url: `/v1/shoot-rooms/${ROOM_ID}/messages`,
      headers: { authorization: 'Bearer provider' },
      payload: { text: 'Lighting diagram', storagePath: `${ROOM_ID}/diagram.jpg` },
    });
    expect(imgRes.statusCode).toBe(201);
    expect(verifyMock).toHaveBeenCalledWith('room-files', `${ROOM_ID}/diagram.jpg`, ROOM_ID);
    expect(imgRes.json().data.type).toBe('image');
  });

  it('rejects non-participants (404) and closed rooms (422 room_closed)', async () => {
    const app = createTestApp();

    queue.push({ kind: 'one', value: { allowed: false } });
    const outsiderRes = await app.inject({
      method: 'POST',
      url: `/v1/shoot-rooms/${ROOM_ID}/messages`,
      headers: { authorization: 'Bearer outsider' },
      payload: { text: 'Hello?' },
    });
    expect(outsiderRes.statusCode).toBe(404);

    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'closed' } },
    );
    const closedRes = await app.inject({
      method: 'POST',
      url: `/v1/shoot-rooms/${ROOM_ID}/messages`,
      headers: { authorization: 'Bearer client' },
      payload: { text: 'Late follow-up' },
    });
    expect(closedRes.statusCode).toBe(422);
    expect(closedRes.json().error.details).toEqual([{ reason: 'room_closed' }]);
  });

  it('creates and updates milestones in an open shoot room', async () => {
    const app = createTestApp();

    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      {
        kind: 'one',
        value: {
          id: MILESTONE_ID,
          roomId: ROOM_ID,
          title: 'Wardrobe fitting',
          dueAt: '2026-11-21T10:00:00.000Z',
          status: 'todo',
          createdBy: PROVIDER_ID,
        },
      },
    );

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/shoot-rooms/${ROOM_ID}/milestones`,
      headers: { authorization: 'Bearer provider' },
      payload: { title: 'Wardrobe fitting', dueAt: '2026-11-21T10:00:00.000Z' },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().data.status).toBe('todo');

    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      {
        kind: 'one',
        value: {
          id: MILESTONE_ID,
          roomId: ROOM_ID,
          title: 'Wardrobe fitting',
          status: 'done',
        },
      },
    );

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/shoot-rooms/${ROOM_ID}/milestones/${MILESTONE_ID}`,
      headers: { authorization: 'Bearer client' },
      payload: { status: 'done' },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.status).toBe('done');
  });

  it('requires counterparty approval for decisions and prevents self-approval or double resolution', async () => {
    const app = createTestApp();

    // Propose decision as client
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      {
        kind: 'one',
        value: {
          id: DECISION_ID,
          roomId: ROOM_ID,
          title: 'Switch to outdoor rooftop',
          description: 'Golden hour natural light',
          proposedBy: CLIENT_ID,
          status: 'proposed',
        },
      },
    );
    const proposeRes = await app.inject({
      method: 'POST',
      url: `/v1/shoot-rooms/${ROOM_ID}/decisions`,
      headers: { authorization: 'Bearer client' },
      payload: { title: 'Switch to outdoor rooftop', description: 'Golden hour natural light' },
    });
    expect(proposeRes.statusCode).toBe(201);

    // Client tries to approve own decision -> 403 counterparty_required
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('confirmed') },
      { kind: 'one', value: { proposedBy: CLIENT_ID, status: 'proposed' } },
    );
    const selfApproveRes = await app.inject({
      method: 'PATCH',
      url: `/v1/shoot-rooms/${ROOM_ID}/decisions/${DECISION_ID}`,
      headers: { authorization: 'Bearer client' },
      payload: { status: 'agreed' },
    });
    expect(selfApproveRes.statusCode).toBe(403);
    expect(selfApproveRes.json().error.details).toEqual([{ reason: 'counterparty_required' }]);

    // Provider approves decision -> 200
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('confirmed') },
      { kind: 'one', value: { proposedBy: CLIENT_ID, status: 'proposed' } },
      {
        kind: 'one',
        value: { id: DECISION_ID, roomId: ROOM_ID, status: 'agreed' },
      },
    );
    const agreeRes = await app.inject({
      method: 'PATCH',
      url: `/v1/shoot-rooms/${ROOM_ID}/decisions/${DECISION_ID}`,
      headers: { authorization: 'Bearer provider' },
      payload: { status: 'agreed' },
    });
    expect(agreeRes.statusCode).toBe(200);
    expect(agreeRes.json().data.status).toBe('agreed');

    // Re-resolving an already agreed decision -> 409 decision_resolved
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('confirmed') },
      { kind: 'one', value: { proposedBy: CLIENT_ID, status: 'agreed' } },
    );
    const conflictRes = await app.inject({
      method: 'PATCH',
      url: `/v1/shoot-rooms/${ROOM_ID}/decisions/${DECISION_ID}`,
      headers: { authorization: 'Bearer provider' },
      payload: { status: 'rejected' },
    });
    expect(conflictRes.statusCode).toBe(409);
    expect(conflictRes.json().error.details).toEqual([{ reason: 'decision_resolved' }]);
  });
});

describe('gallery proofing and selections (106b)', () => {
  it('allows provider to upload gallery previews during in_progress and blocks during proofing', async () => {
    const app = createTestApp();

    verifyMock.mockResolvedValueOnce({
      width: 1280,
      height: 853,
      mimeType: 'image/jpeg',
    });
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('in_progress') },
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: GALLERY_ID } },
      {
        kind: 'one',
        value: {
          id: IMAGE_1_ID,
          galleryId: GALLERY_ID,
          storagePath: `${BOOKING_ID}/shot-01.jpg`,
          width: 1280,
          height: 853,
          caption: 'Look 1',
          provenance: 'captured',
        },
      },
    );

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/gallery-images`,
      headers: { authorization: 'Bearer provider' },
      payload: {
        storagePath: `${BOOKING_ID}/shot-01.jpg`,
        caption: 'Look 1',
        provenance: 'captured',
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    expect(uploadRes.json().data.id).toBe(IMAGE_1_ID);

    // Locked once booking moves to proofing -> 422 gallery_locked
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('proofing') },
      { kind: 'one', value: { allowed: true } },
    );
    const lockedRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/gallery-images`,
      headers: { authorization: 'Bearer provider' },
      payload: { storagePath: `${BOOKING_ID}/shot-02.jpg` },
    });
    expect(lockedRes.statusCode).toBe(422);
    expect(lockedRes.json().error.details).toEqual([{ reason: 'gallery_locked' }]);
  });

  it('submits client selections by round, rejects foreign image IDs, and lets provider reopen next round', async () => {
    const app = createTestApp();

    // Foreign/invalid imageId in selection -> 422 invalid_selection
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('proofing') },
      { kind: 'one', value: { id: GALLERY_ID, status: 'open_for_selection', round: 1 } },
      { kind: 'rows', value: [{ id: IMAGE_1_ID }] }, // requested 2, found 1
    );
    const invalidSelRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/selections`,
      headers: { authorization: 'Bearer client' },
      payload: { imageIds: [IMAGE_1_ID, IMAGE_2_ID] },
    });
    expect(invalidSelRes.statusCode).toBe(422);
    expect(invalidSelRes.json().error.details).toEqual([{ reason: 'invalid_selection' }]);

    // Valid client selection submission -> 201
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('proofing') },
      { kind: 'one', value: { id: GALLERY_ID, status: 'open_for_selection', round: 1 } },
      { kind: 'rows', value: [{ id: IMAGE_1_ID }, { id: IMAGE_2_ID }] },
      { kind: 'execute', value: 1 },
      { kind: 'execute', value: 1 },
      { kind: 'one', value: { id: GALLERY_ID, status: 'selection_submitted', round: 1 } },
    );
    const submitRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/selections`,
      headers: { authorization: 'Bearer client' },
      payload: { imageIds: [IMAGE_1_ID, IMAGE_2_ID] },
    });
    expect(submitRes.statusCode).toBe(201);
    expect(submitRes.json().data.status).toBe('selection_submitted');

    // Provider reopens selection for round 2 -> 200
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('proofing') },
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: { id: GALLERY_ID, status: 'open_for_selection', round: 2 } },
    );
    const reopenRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/selections/reopen`,
      headers: { authorization: 'Bearer provider' },
    });
    expect(reopenRes.statusCode).toBe(200);
    expect(reopenRes.json().data).toEqual({
      id: GALLERY_ID,
      status: 'open_for_selection',
      round: 2,
    });
  });
});

describe('deliveries, reviews, and timeline (106c–106d)', () => {
  it('registers delivery files only when booking is in proofing', async () => {
    const app = createTestApp();

    // Non-proofing status -> 422 delivery_locked
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('in_progress') },
      { kind: 'one', value: { allowed: true } },
    );
    const lockedRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/deliveries`,
      headers: { authorization: 'Bearer provider' },
      payload: { storagePath: `${BOOKING_ID}/final.zip`, fileName: 'final.zip' },
    });
    expect(lockedRes.statusCode).toBe(422);
    expect(lockedRes.json().error.details).toEqual([{ reason: 'delivery_locked' }]);

    // Proofing status -> 201
    verifyMock.mockResolvedValueOnce({
      width: 0,
      height: 0,
      mimeType: 'application/zip',
    });
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('proofing') },
      { kind: 'one', value: { allowed: true } },
      {
        kind: 'one',
        value: {
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          bookingId: BOOKING_ID,
          storagePath: `${BOOKING_ID}/final.zip`,
          fileName: 'final.zip',
          mimeType: 'application/zip',
        },
      },
    );
    const okRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/deliveries`,
      headers: { authorization: 'Bearer provider' },
      payload: { storagePath: `${BOOKING_ID}/final.zip`, fileName: 'final.zip' },
    });
    expect(okRes.statusCode).toBe(201);
    expect(verifyMock).toHaveBeenCalledWith(
      'deliveries',
      `${BOOKING_ID}/final.zip`,
      BOOKING_ID,
      false,
    );
    expect(okRes.json().data.fileName).toBe('final.zip');
  });

  it('allows one client review after booking completion and rejects premature or duplicate reviews', async () => {
    const app = createTestApp();

    // Provider cannot post review -> 403 forbidden
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('completed') },
    );
    const providerRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/reviews`,
      headers: { authorization: 'Bearer provider' },
      payload: { rating: 5, comment: 'Great client' },
    });
    expect(providerRes.statusCode).toBe(403);

    // Delivered but not yet completed -> 422 booking_not_completed
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('delivered') },
    );
    const prematureRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/reviews`,
      headers: { authorization: 'Bearer client' },
      payload: { rating: 5, comment: 'Awesome photos' },
    });
    expect(prematureRes.statusCode).toBe(422);
    expect(prematureRes.json().error.details).toEqual([{ reason: 'booking_not_completed' }]);

    // Completed booking -> 201
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('completed') },
      {
        kind: 'one',
        value: {
          id: '12121212-1212-4121-8121-121212121212',
          bookingId: BOOKING_ID,
          authorId: CLIENT_ID,
          photographerId: PHOTOGRAPHER_ID,
          studioId: null,
          rating: 5,
          comment: 'Exceeded expectations',
        },
      },
    );
    const okRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/reviews`,
      headers: { authorization: 'Bearer client' },
      payload: { rating: 5, comment: 'Exceeded expectations' },
    });
    expect(okRes.statusCode).toBe(201);
    expect(okRes.json().data.rating).toBe(5);

    // Duplicate lifetime review -> DB 23505 mapped to 409 already_exists
    queue.push(
      { kind: 'one', value: { allowed: true } },
      { kind: 'one', value: sampleBooking('completed') },
      { kind: 'throw', error: { code: '23505', constraint: 'reviews_booking_id_key' } },
    );
    const dupRes = await app.inject({
      method: 'POST',
      url: `/v1/bookings/${BOOKING_ID}/reviews`,
      headers: { authorization: 'Bearer client' },
      payload: { rating: 4, comment: 'Second review' },
    });
    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.json().error.details).toEqual([{ reason: 'already_exists' }]);
  });

  it('returns caller timeline bookings within valid range and rejects ranges over 62 days', async () => {
    const app = createTestApp();

    const badRangeRes = await app.inject({
      method: 'GET',
      url: '/v1/me/timeline?from=2026-11-01T00:00:00.000Z&to=2027-02-01T00:00:00.000Z',
      headers: { authorization: 'Bearer client' },
    });
    expect(badRangeRes.statusCode).toBe(400);
    expect(badRangeRes.json().error.details).toEqual([{ reason: 'invalid_range' }]);

    queue.push({ kind: 'rows', value: [sampleBooking('confirmed')] });
    const okRes = await app.inject({
      method: 'GET',
      url: '/v1/me/timeline?from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z',
      headers: { authorization: 'Bearer client' },
    });
    expect(okRes.statusCode).toBe(200);
    expect(okRes.json().data).toHaveLength(1);
    expect(okRes.json().data[0].id).toBe(BOOKING_ID);
  });
  // ---- Enhanced edge cases for shoot rooms ----
  describe('enhanced edge cases for shoot rooms', () => {
    it('rejects client trying to approve own decision (403 counterparty_required)', async () => {
      const app = createTestApp();
      // propose decision as client
      queue.push(
        { kind: 'one', value: { allowed: true } },
        { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
        {
          kind: 'one',
          value: {
            id: DECISION_ID,
            roomId: ROOM_ID,
            title: 'Switch',
            description: 'desc',
            proposedBy: CLIENT_ID,
            status: 'proposed',
          },
        },
      );
      const proposeRes = await app.inject({
        method: 'POST',
        url: `/v1/shoot-rooms/${ROOM_ID}/decisions`,
        headers: { authorization: 'Bearer client' },
        payload: { title: 'Switch', description: 'desc' },
      });
      expect(proposeRes.statusCode).toBe(201);
      // client attempts self‑approval
      queue.push(
        { kind: 'one', value: { allowed: true } },
        { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
        { kind: 'one', value: { allowed: true } }, // booking
        { kind: 'one', value: sampleBooking('confirmed') },
        { kind: 'one', value: { proposedBy: CLIENT_ID, status: 'proposed' } },
      );
      const selfApprove = await app.inject({
        method: 'PATCH',
        url: `/v1/shoot-rooms/${ROOM_ID}/decisions/${DECISION_ID}`,
        headers: { authorization: 'Bearer client' },
        payload: { status: 'agreed' },
      });
      expect(selfApprove.statusCode).toBe(403);
      expect(selfApprove.json().error.details).toEqual([{ reason: 'counterparty_required' }]);
    });

    it('returns 422 when posting a milestone to a closed room', async () => {
      const app = createTestApp();
      queue.push(
        { kind: 'one', value: { allowed: true } },
        { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'closed' } },
      );
      const res = await app.inject({
        method: 'POST',
        url: `/v1/shoot-rooms/${ROOM_ID}/milestones`,
        headers: { authorization: 'Bearer provider' },
        payload: { title: 'Edit', dueAt: '2026-12-01T00:00:00.000Z' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.details).toEqual([{ reason: 'room_closed' }]);
    });

    it('fails image upload when storage verification throws', async () => {
      const app = createTestApp();
      verifyMock.mockRejectedValueOnce(new Error('Verification failed'));
      queue.push(
        { kind: 'one', value: { allowed: true } },
        { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
      );
      const res = await app.inject({
        method: 'POST',
        url: `/v1/shoot-rooms/${ROOM_ID}/messages`,
        headers: { authorization: 'Bearer provider' },
        payload: { text: 'bad image', storagePath: `${ROOM_ID}/bad.jpg` },
      });
      expect(res.statusCode).toBe(500);
    });

    it('maps duplicate decision DB error to 409 decision_resolved', async () => {
      const app = createTestApp();
      queue.push(
        { kind: 'one', value: { allowed: true } },
        { kind: 'one', value: { id: ROOM_ID, bookingId: BOOKING_ID, status: 'open' } },
        { kind: 'one', value: { allowed: true } }, // booking
        { kind: 'one', value: sampleBooking('confirmed') },
        { kind: 'throw', error: { code: '23505', constraint: 'room_decisions_pkey' } },
      );
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/shoot-rooms/${ROOM_ID}/decisions/${DECISION_ID}`,
        headers: { authorization: 'Bearer provider' },
        payload: { status: 'agreed' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.details).toEqual([{ reason: 'already_exists' }]);
    });
  });
});
