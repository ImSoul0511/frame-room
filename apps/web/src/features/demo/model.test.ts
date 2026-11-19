import { describe, expect, it } from 'vitest';
import {
  applyDemoAction as act,
  agreedBrief,
  currentBrief,
  isAvailable,
  validateDemoFile,
} from './model';
import { createDemoBrief, createDemoService, createDemoState, seedPhotos } from './seed';
import {
  canReadBooking,
  canReadMessage,
  canUseRoom,
  getNavigation,
  isManager,
  ownsProvider,
} from './permissions';
import { getDemoProviderDetail } from './public-catalog';
import type { DemoAction, DemoRole, DemoState } from './types';

const clock = Date.parse('2026-11-19T00:00:00Z');
const fresh = () => createDemoState(clock);
const booking = (state: DemoState, number = 1) =>
  state.bookings.find((value) => value.id === `demo-booking-${number}`)!;
const expectFailure = (
  state: DemoState,
  actor: DemoRole,
  action: DemoAction,
  reason = 'forbidden',
) => {
  const before = structuredClone(state);
  expect(() => act(state, actor, action)).toThrow(reason);
  expect(state).toEqual(before);
};
const approveAssign = () => {
  let state = act(fresh(), 'manager', { type: 'approve', id: 'demo-booking-1' });
  state = act(state, 'manager', {
    type: 'assign',
    id: 'demo-booking-1',
    person: 'photographer2',
    reason: '',
    expectedVersion: booking(state).version,
  });
  return state;
};
const select = (state: DemoState, number = 4) =>
  act(state, 'client', {
    type: 'select',
    id: booking(state, number).id,
    ids: booking(state, number)
      .gallery.slice(0, 3)
      .map((photo) => photo.id),
    note: 'Warm tones',
    pins: [{ imageId: booking(state, number).gallery[0].id, x: 25, y: 75, note: 'Softer shadows' }],
  });

describe('role-aware demo navigation and studio authority', () => {
  it('exposes only the appropriate primary workspaces', () => {
    expect(getNavigation('guest')).toEqual(['explore']);
    expect(getNavigation('client')).toContain('projects');
    expect(getNavigation('client')).not.toContain('studio');
    expect(getNavigation('photographer')).not.toContain('projects');
    expect(getNavigation('photographer')).toContain('portfolio');
    expect(getNavigation('admin')).toEqual(['admin', 'explore']);
  });
  it('scopes management to each studio independently of display specialties', () => {
    let state = fresh();
    expect(isManager(state, 'manager', 'demo-studio')).toBe(true);
    expect(isManager(state, 'manager', 'demo-studio-2')).toBe(false);
    expect(ownsProvider(state, 'photographer', 'demo-studio')).toBe(false);
    state = act(state, 'photographer', {
      type: 'profile',
      profile: { ...state.profiles.photographer, specialties: ['artDirector', 'retoucher'] },
    });
    expectFailure(state, 'photographer', {
      type: 'invite',
      id: 'invite',
      studio: 'demo-studio',
      person: 'manager',
      role: 'manager',
    });
    expectFailure(state, 'manager', {
      type: 'studio-update',
      studio: { ...state.studios[1], name: 'Unauthorized' },
    });
    expectFailure(state, 'admin', {
      type: 'studio',
      studio: { ...state.studios[0], id: 'new-studio' },
    });
  });
  it('creates a studio with its photographer as initial manager', () => {
    const state = act(fresh(), 'photographer', {
      type: 'studio',
      studio: {
        id: 'new-studio',
        name: 'New studio',
        city: 'Hue',
        address: '',
        description: '',
        contact: 'demo@example.test',
      },
    });
    expect(isManager(state, 'photographer', 'new-studio')).toBe(true);
  });
  it('requires the invitee to respond, blocks duplicates and preserves active assignments', () => {
    const state = fresh();
    expectFailure(state, 'manager', { type: 'invitation', id: 'demo-invitation', accept: true });
    const accepted = act(state, 'photographer', {
      type: 'invitation',
      id: 'demo-invitation',
      accept: true,
    });
    expect(accepted.members).toContainEqual({
      studio: 'demo-studio-2',
      person: 'photographer',
      role: 'photographer',
    });
    expectFailure(
      accepted,
      'photographer2',
      {
        type: 'invite',
        id: 'again',
        studio: 'demo-studio-2',
        person: 'photographer',
        role: 'manager',
      },
      'duplicateInvitation',
    );
    expectFailure(
      state,
      'manager',
      { type: 'member', studio: 'demo-studio', person: 'manager', role: 'remove' },
      'lastManager',
    );
    expectFailure(
      state,
      'manager',
      { type: 'member', studio: 'demo-studio', person: 'photographer', role: 'remove' },
      'activeAssignment',
    );
    const removed = act(state, 'manager', {
      type: 'member',
      studio: 'demo-studio',
      person: 'photographer2',
      role: 'remove',
    });
    expect(
      removed.members.some(
        (value) => value.studio === 'demo-studio' && value.person === 'photographer2',
      ),
    ).toBe(false);
  });
});

describe('booking agreement, assignment and collaboration', () => {
  it('closes a rejected proposal without changing the prior agreement', () => {
    const state = fresh();
    const proposed = act(state, 'client', {
      type: 'brief',
      id: 'demo-booking-2',
      brief: { ...agreedBrief(booking(state, 2)), concept: 'Another direction' },
    });
    const rejected = act(proposed, 'manager', {
      type: 'brief-reject',
      id: 'demo-booking-2',
      reason: 'Please revise the scope',
    });
    expect(booking(rejected, 2).agreedVersion).toBe(1);
    expectFailure(rejected, 'manager', { type: 'approve', id: 'demo-booking-2' }, 'stateLocked');
    const revised = act(rejected, 'client', {
      type: 'brief',
      id: 'demo-booking-2',
      brief: { ...currentBrief(booking(rejected, 2)), concept: 'Revised direction' },
    });
    expect(currentBrief(booking(revised, 2))).toMatchObject({ version: 3, rejection: undefined });
    expect(
      booking(act(revised, 'manager', { type: 'approve', id: 'demo-booking-2' }), 2).agreedVersion,
    ).toBe(3);
  });
  it('requires a shared latest brief and keeps initial assignment separate from confirmation', () => {
    const initial = fresh();
    expectFailure(
      initial,
      'manager',
      { type: 'confirm', id: booking(initial).id },
      'briefApprovals',
    );
    expectFailure(
      initial,
      'manager',
      {
        type: 'assign',
        id: booking(initial).id,
        person: 'photographer',
        reason: '',
        expectedVersion: 1,
      },
      'briefApprovals',
    );
    const assigned = approveAssign();
    expect(booking(assigned)).toMatchObject({
      status: 'pending',
      roomId: null,
      assigned: 'photographer2',
    });
    expectFailure(assigned, 'photographer2', { type: 'confirm', id: booking(assigned).id });
    const confirmed = act(assigned, 'manager', { type: 'confirm', id: booking(assigned).id });
    expect(booking(confirmed)).toMatchObject({
      status: 'confirmed',
      roomId: 'room-demo-booking-1',
    });
    expect(confirmed.conversations).toEqual(initial.conversations);
    expect(act(confirmed, 'manager', { type: 'confirm', id: booking(confirmed).id })).toBe(
      confirmed,
    );
    expect(initial).toEqual(fresh());
  });
  it('preserves the agreed version until both sides approve a replacement', () => {
    const state = fresh();
    const oldBrief = structuredClone(agreedBrief(booking(state, 2)));
    const proposed = act(state, 'client', {
      type: 'brief',
      id: booking(state, 2).id,
      brief: { ...oldBrief, concept: 'Updated concept', quota: 2 },
    });
    expect(agreedBrief(booking(proposed, 2))).toEqual(oldBrief);
    expect(currentBrief(booking(proposed, 2))).toMatchObject({
      version: 2,
      clientApproved: true,
      providerApproved: false,
    });
    const approved = act(proposed, 'manager', { type: 'approve', id: booking(proposed, 2).id });
    expect(booking(approved, 2).agreedVersion).toBe(2);
    expect(booking(approved, 2).briefs[0]).toEqual(oldBrief);
  });
  it('checks membership, stale assignment versions and cross-studio schedule conflicts', () => {
    const state = act(fresh(), 'manager', { type: 'approve', id: 'demo-booking-1' });
    expectFailure(
      state,
      'manager',
      {
        type: 'assign',
        id: 'demo-booking-1',
        person: 'photographer2',
        reason: '',
        expectedVersion: 1,
      },
      'staleVersion',
    );
    expectFailure(
      state,
      'manager',
      {
        type: 'assign',
        id: 'demo-booking-1',
        person: 'client',
        reason: '',
        expectedVersion: booking(state).version,
      },
      'notMember',
    );
    const conflicting = act(state, 'client', {
      type: 'brief',
      id: 'demo-booking-1',
      brief: {
        ...currentBrief(booking(state)),
        startsAt: agreedBrief(booking(state, 2)).startsAt,
        endsAt: agreedBrief(booking(state, 2)).endsAt,
      },
    });
    const approved = act(conflicting, 'manager', { type: 'approve', id: 'demo-booking-1' });
    expectFailure(
      approved,
      'manager',
      {
        type: 'assign',
        id: 'demo-booking-1',
        person: 'photographer',
        reason: '',
        expectedVersion: booking(approved).version,
      },
      'scheduleConflict',
    );
    expect(isAvailable(state, 'photographer', agreedBrief(booking(state, 2)))).toBe(false);
  });
  it('revokes the former assignee context after reassignment without granting general chat', () => {
    const state = fresh();
    const conversation = state.conversations.find((value) => value.provider === 'demo-studio')!;
    expect(canReadMessage(state, 'photographer', conversation, null)).toBe(false);
    expect(canReadMessage(state, 'photographer', conversation, 'demo-booking-2')).toBe(true);
    expectFailure(
      state,
      'manager',
      {
        type: 'assign',
        id: 'demo-booking-2',
        person: 'photographer2',
        reason: '',
        expectedVersion: 1,
      },
      'reasonRequired',
    );
    const next = act(state, 'manager', {
      type: 'assign',
      id: 'demo-booking-2',
      person: 'photographer2',
      reason: 'Availability changed',
      expectedVersion: 1,
    });
    expect(canReadBooking(next, 'photographer', booking(next, 2))).toBe(false);
    expect(canReadMessage(next, 'photographer', conversation, 'demo-booking-2')).toBe(false);
    expect(canReadMessage(next, 'photographer2', conversation, 'demo-booking-2')).toBe(true);
    expect(canReadMessage(next, 'photographer2', conversation, null)).toBe(false);
    expect(canReadMessage(next, 'photographer2', conversation, 'demo-booking-3')).toBe(false);
  });
  it('reuses one conversation across bookings and deduplicates message submissions', () => {
    const state = fresh();
    const conversation = state.conversations.find((value) => value.provider === 'demo-studio')!;
    expect(
      act(state, 'client', {
        type: 'conversation',
        id: 'duplicate',
        provider: 'demo-studio',
        providerType: 'studio',
        providerName: 'studioName',
      }),
    ).toBe(state);
    const action: DemoAction = {
      type: 'message',
      id: 'message-1',
      conversation: conversation.id,
      booking: 'demo-booking-2',
      text: 'Ready',
      submission: 'one-click',
    };
    const next = act(state, 'photographer', action);
    expect(act(next, 'photographer', action)).toBe(next);
    expectFailure(state, 'photographer', { ...action, booking: null });
    expectFailure(state, 'client', { ...action, booking: 'demo-booking-1' }, 'roomClosed');
    expectFailure(state, 'client', { ...action, booking: 'demo-booking-4' });
  });
  it('closes room writes after proofing and keeps decisions independent from booking status', () => {
    const state = fresh();
    const next = act(state, 'client', {
      type: 'decision',
      id: 'demo-booking-2',
      text: 'Choose a location',
    });
    const decision = booking(next, 2).decisions[0];
    expectFailure(
      next,
      'client',
      { type: 'decision-result', id: 'demo-booking-2', decision: decision.id, result: 'agreed' },
      'counterpartyRequired',
    );
    const agreed = act(next, 'photographer', {
      type: 'decision-result',
      id: 'demo-booking-2',
      decision: decision.id,
      result: 'agreed',
    });
    expect(booking(agreed, 2).status).toBe('confirmed');
    expect(canUseRoom(agreed, 'client', booking(agreed, 4))).toBe(false);
    expectFailure(
      agreed,
      'client',
      { type: 'milestone', id: 'demo-booking-4', title: 'Closed room' },
      'roomClosed',
    );
  });
  it('requires the opposite business side to approve cancellation', () => {
    const state = act(fresh(), 'client', {
      type: 'cancel',
      id: 'demo-booking-2',
      reason: 'Schedule changed',
    });
    expect(booking(state, 2).status).toBe('confirmed');
    expectFailure(
      state,
      'client',
      { type: 'cancel-agree', id: 'demo-booking-2', reason: '' },
      'counterpartyRequired',
    );
    expect(
      booking(act(state, 'manager', { type: 'cancel-agree', id: 'demo-booking-2', reason: '' }), 2)
        .status,
    ).toBe('cancelled');
    expect(
      booking(
        act(fresh(), 'client', { type: 'cancel', id: 'demo-booking-1', reason: 'Changed plans' }),
      ).status,
    ).toBe('cancelled');
    expectFailure(
      fresh(),
      'client',
      { type: 'cancel', id: 'demo-booking-5', reason: 'Late request' },
      'stateLocked',
    );
  });
});

describe('public catalog and snapshot safety', () => {
  it('snapshots current service terms and rejects a stale unpublished offer', () => {
    const original = fresh();
    const service = original.services[0];
    const action: DemoAction = {
      type: 'book',
      id: 'new-booking',
      provider: service.owner,
      providerType: 'photographer',
      providerName: 'photographerName',
      service,
      brief: createDemoBrief(clock),
    };
    const booked = act(original, 'client', action);
    expect(booked.bookings[0]).toMatchObject({ roomId: null, status: 'pending', assigned: null });
    expect(booked.conversations).toEqual(original.conversations);
    const edited = act(booked, 'photographer', {
      type: 'service',
      service: { ...service, price: 9000000, published: false },
    });
    expect(edited.bookings[0].service.price).toBe(service.price);
    expectFailure(edited, 'client', { ...action, id: 'another' }, 'serviceUnavailable');
    expectFailure(original, 'guest', action, 'authentication');
    expectFailure(original, 'photographer', action);
  });
  it('handles real-provider demo offers locally and enforces representative schedule conflicts', () => {
    const original = fresh();
    const service = createDemoService('external-provider');
    const state = act(original, 'client', {
      type: 'book',
      id: 'external-booking',
      provider: service.owner,
      providerType: 'photographer',
      providerName: 'Public photographer',
      service,
      brief: {
        ...createDemoBrief(clock),
        startsAt: agreedBrief(booking(original, 2)).startsAt,
        endsAt: agreedBrief(booking(original, 2)).endsAt,
      },
    });
    const approved = act(state, 'photographer', { type: 'approve', id: 'external-booking' });
    expectFailure(
      approved,
      'photographer',
      { type: 'confirm', id: 'external-booking' },
      'scheduleConflict',
    );
    expect(original.representatives).toEqual({});
  });
  it('requires images before publication and excludes moderated content from public views', () => {
    const state = fresh();
    const album = state.albums[1];
    expectFailure(
      state,
      'manager',
      { type: 'album', album: { ...album, photos: [], published: true } },
      'imageRequired',
    );
    expectFailure(
      state,
      'client',
      {
        type: 'report',
        id: 'private-report',
        target: album.id,
        targetType: 'portfolio',
        title: 'Draft',
        reason: 'copyright',
        details: '',
      },
      'notFound',
    );
    const reported = act(state, 'client', {
      type: 'report',
      id: 'report',
      target: 'demo-album',
      targetType: 'portfolio',
      title: 'Work',
      reason: 'copyright',
      details: 'Attribution',
    });
    expect(reported.hiddenTargets).not.toContain('demo-album');
    expectFailure(reported, 'client', {
      type: 'moderate',
      id: 'report',
      outcome: 'actioned',
      reason: 'Hide',
    });
    expectFailure(
      reported,
      'admin',
      { type: 'moderate', id: 'report', outcome: 'actioned', reason: '' },
      'reasonRequired',
    );
    const hidden = act(reported, 'admin', {
      type: 'moderate',
      id: 'report',
      outcome: 'actioned',
      reason: 'Attribution required',
    });
    expect(
      getDemoProviderDetail(
        hidden,
        'photographer',
        (value) => value,
        (url) => url,
      )?.portfolios,
    ).toEqual([]);
  });
  it('validates attachment boundaries and numeric brief fields', () => {
    const file = {
      id: 'file',
      name: 'image.webp',
      url: 'blob:demo',
      mime: 'image/webp',
      size: 50 * 1024 * 1024,
    };
    expect(() => validateDemoFile(file)).not.toThrow();
    expect(() => validateDemoFile({ ...file, size: file.size + 1 })).toThrow('fileTooLarge');
    expect(() => validateDemoFile({ ...file, mime: 'text/html' })).toThrow('fileType');
    expectFailure(
      fresh(),
      'client',
      { type: 'brief', id: 'demo-booking-1', brief: { ...createDemoBrief(clock), quota: 1.5 } },
      'invalidInput',
    );
  });
});

describe('proofing, delivery and reviews', () => {
  it('requires in-progress upload, enforces quota and percent-based annotation bounds', () => {
    const state = fresh();
    expectFailure(
      state,
      'photographer',
      { type: 'gallery', id: 'demo-booking-2', photos: seedPhotos() },
      'stateLocked',
    );
    const uploaded = act(state, 'photographer', {
      type: 'gallery',
      id: 'demo-booking-3',
      photos: seedPhotos(),
    });
    expect(booking(uploaded, 3).status).toBe('proofing');
    expectFailure(
      uploaded,
      'client',
      {
        type: 'select',
        id: 'demo-booking-3',
        ids: seedPhotos().map((photo) => photo.id),
        note: '',
        pins: [],
      },
      'selectionQuota',
    );
    expectFailure(
      uploaded,
      'client',
      {
        type: 'select',
        id: 'demo-booking-3',
        ids: ['demo-image-0'],
        note: '',
        pins: [{ imageId: 'demo-image-0', x: 101, y: 50, note: 'Out of bounds' }],
      },
      'invalidInput',
    );
    const selected = select(uploaded, 3);
    expect(booking(selected, 3).selections[0].pins[0]).toMatchObject({ x: 25, y: 75 });
    expectFailure(
      selected,
      'client',
      { type: 'select', id: 'demo-booking-3', ids: ['demo-image-0'], note: '', pins: [] },
      'stateLocked',
    );
  });
  it('bounds revisions and requires new final files for the latest submitted round', () => {
    let state = select(fresh());
    const file = seedPhotos()[0];
    state = act(state, 'photographer', { type: 'delivery', id: 'demo-booking-4', file });
    state = act(state, 'photographer', { type: 'reopen', id: 'demo-booking-4' });
    expect(booking(state, 4).deliveries).toEqual([]);
    expectFailure(
      state,
      'photographer',
      { type: 'deliver', id: 'demo-booking-4' },
      'deliveryRequired',
    );
    state = select(state);
    state = act(state, 'photographer', { type: 'reopen', id: 'demo-booking-4' });
    state = select(state);
    expectFailure(state, 'photographer', { type: 'reopen', id: 'demo-booking-4' }, 'revisionLimit');
    state = act(state, 'photographer', { type: 'delivery', id: 'demo-booking-4', file });
    state = act(state, 'photographer', { type: 'deliver', id: 'demo-booking-4' });
    expect(booking(state, 4).status).toBe('delivered');
    expect(
      booking(act(state, 'client', { type: 'complete', id: 'demo-booking-4' }), 4).status,
    ).toBe('completed');
  });
  it('pauses the 168-hour countdown on manual hold and never creates an automatic review', () => {
    let state = act(fresh(), 'admin', { type: 'advance', hours: 24 });
    expect(booking(state, 5).remainingMs).toBe(144 * 3600000);
    state = act(state, 'admin', {
      type: 'hold',
      id: 'demo-booking-5',
      hold: true,
      reason: 'Dispute under review',
    });
    expectFailure(state, 'client', { type: 'complete', id: 'demo-booking-5' }, 'stateLocked');
    state = act(state, 'admin', { type: 'advance', hours: 168 });
    expect(booking(state, 5)).toMatchObject({ status: 'delivered', remainingMs: 144 * 3600000 });
    state = act(state, 'admin', {
      type: 'hold',
      id: 'demo-booking-5',
      hold: false,
      reason: 'Resolved',
    });
    expect(
      act(state, 'admin', { type: 'hold', id: 'demo-booking-5', hold: false, reason: 'Repeated' }),
    ).toBe(state);
    state = act(state, 'admin', { type: 'advance', hours: 143 });
    expect(booking(state, 5).status).toBe('delivered');
    state = act(state, 'admin', { type: 'advance', hours: 1 });
    expect(booking(state, 5).status).toBe('completed');
    expect(state.reviews).toEqual([]);
    expect(state.history.some((value) => value.action === 'autoComplete')).toBe(true);
  });
  it('retains one lifetime review through hide, edit, reassess and restore', () => {
    const reviewAction: DemoAction = {
      type: 'review',
      id: 'demo-booking-6',
      rating: 5,
      comment: 'Thoughtful work',
    };
    expectFailure(
      fresh(),
      'client',
      { ...reviewAction, id: 'demo-booking-5' },
      'reviewEligibility',
    );
    expectFailure(fresh(), 'client', { ...reviewAction, rating: 4.5 }, 'reviewInvalid');
    let state = act(fresh(), 'client', reviewAction);
    const reviewId = state.reviews[0].id;
    expectFailure(state, 'client', reviewAction, 'reviewExists');
    state = act(state, 'photographer', {
      type: 'report',
      id: 'review-report',
      target: reviewId,
      targetType: 'review',
      title: 'Review',
      reason: 'other',
      details: 'Please check',
    });
    state = act(state, 'admin', {
      type: 'moderate',
      id: 'review-report',
      outcome: 'actioned',
      reason: 'Edit personal information',
    });
    expectFailure(
      state,
      'admin',
      { type: 'review-visibility', id: reviewId, visible: true, reason: 'Too early' },
      'stateLocked',
    );
    state = act(state, 'client', { ...reviewAction, rating: 4, comment: 'Edited review' });
    expect(state.reviews).toHaveLength(1);
    expect(state.reviews[0]).toMatchObject({ id: reviewId, hidden: true, reassessment: true });
    expect(
      getDemoProviderDetail(
        state,
        'photographer',
        (value) => value,
        (url) => url,
      )?.provider.reviewCount,
    ).toBe(0);
    state = act(state, 'admin', {
      type: 'review-visibility',
      id: reviewId,
      visible: true,
      reason: 'Reassessed',
    });
    expect(state.reviews[0]).toMatchObject({ id: reviewId, hidden: false, reassessment: false });
    expect(
      getDemoProviderDetail(
        state,
        'photographer',
        (value) => value,
        (url) => url,
      )?.provider.ratingAvg,
    ).toBe(4);
    expectFailure(state, 'client', reviewAction, 'reviewExists');
  });
});
