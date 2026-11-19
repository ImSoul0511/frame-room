import type { DemoAction, DemoBooking, DemoBrief, DemoFile, DemoRole, DemoState } from './types';
import {
  canManageBooking,
  canReadBooking,
  canReadMessage,
  canUseRoom,
  canWorkBooking,
  isManager,
  isPhotographer,
  ownsProvider,
} from './permissions';

export class DemoError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
function requireRule(condition: unknown, reason = 'forbidden'): asserts condition {
  if (!condition) throw new DemoError(reason);
}
const id = (state: DemoState, prefix: string) => `${prefix}-${state.history.length}-${state.clock}`;
export const currentBrief = (booking: DemoBooking) => booking.briefs[booking.briefs.length - 1];
export const agreedBrief = (booking: DemoBooking) =>
  booking.briefs.find((brief) => brief.version === booking.agreedVersion) ?? currentBrief(booking);
export const selectionSubmitted = (booking: DemoBooking) =>
  booking.selections.some((selection) => selection.round === booking.round);
function overlaps(a: string, b: string, c: string, d: string) {
  return (
    new Date(a).getTime() < new Date(d).getTime() && new Date(c).getTime() < new Date(b).getTime()
  );
}
export function isAvailable(
  state: DemoState,
  person: string,
  brief: Pick<DemoBrief, 'startsAt' | 'endsAt'>,
  except?: string,
) {
  person = state.representatives[person] ?? person;
  return (
    !state.bookings.some(
      (booking) =>
        booking.id !== except &&
        !['pending', 'rejected', 'cancelled', 'completed'].includes(booking.status) &&
        (booking.assigned === person ||
          booking.provider === person ||
          state.representatives[booking.provider] === person) &&
        overlaps(
          brief.startsAt,
          brief.endsAt,
          agreedBrief(booking).startsAt,
          agreedBrief(booking).endsAt,
        ),
    ) &&
    !state.blocks.some(
      (block) =>
        block.owner === person && overlaps(brief.startsAt, brief.endsAt, block.start, block.end),
    )
  );
}
function validateBrief(brief: DemoBrief, clock: number, future = false) {
  requireRule(
    brief.concept.trim() && brief.location.trim() && brief.locationType && brief.genre,
    'briefRequired',
  );
  const start = Date.parse(brief.startsAt),
    end = Date.parse(brief.endsAt);
  requireRule(
    Number.isFinite(start) && end > start && (!future || start > clock),
    'invalidSchedule',
  );
  requireRule(
    [brief.people, brief.photoCount, brief.retouched, brief.quota, brief.revisions].every(
      Number.isInteger,
    ) &&
      Number.isFinite(brief.budget) &&
      brief.people > 0 &&
      brief.photoCount > 0 &&
      brief.retouched >= 0 &&
      brief.retouched <= brief.photoCount &&
      brief.quota > 0 &&
      brief.quota <= brief.photoCount &&
      brief.revisions >= 0 &&
      brief.budget >= 0,
    'invalidInput',
  );
  brief.references.forEach(validateDemoFile);
}
export function validateDemoFile(file: DemoFile) {
  requireRule(file.size <= 50 * 1024 * 1024 && file.size >= 0, 'fileTooLarge');
  requireRule(
    ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/zip'].includes(
      file.mime,
    ),
    'fileType',
  );
}
function audit(state: DemoState, actor: string, action: string, booking?: string, reason = '') {
  state.history.unshift({
    id: id(state, 'event'),
    actor,
    action,
    booking,
    reason,
    at: state.clock,
  });
}
function notify(state: DemoState, recipient: string, text: string, href: string) {
  state.notifications.unshift({
    id: `${id(state, 'notice')}-${state.notifications.length}`,
    recipient,
    text,
    href,
    read: false,
  });
}
export function applyDemoAction(
  original: DemoState,
  actor: DemoRole,
  action: DemoAction,
): DemoState {
  requireRule(actor !== 'guest', 'authentication');
  const state = structuredClone(original);
  const booking =
    'id' in action ? state.bookings.find((value) => value.id === action.id) : undefined;
  function visibleBooking(): DemoBooking {
    requireRule(booking && canReadBooking(state, actor, booking));
    return booking;
  }
  function worker(): DemoBooking {
    const value = visibleBooking();
    requireRule(canWorkBooking(state, actor, value));
    return value;
  }
  function manager(studio: string) {
    requireRule(isManager(state, actor, studio));
  }
  function representProvider(
    provider: string,
    providerType: 'studio' | 'photographer',
    name: string,
  ) {
    if (providerType === 'photographer' && !state.profiles[provider])
      state.representatives[provider] = 'photographer';
    if (providerType === 'studio' && !state.studios.some((studio) => studio.id === provider)) {
      state.studios.push({
        id: provider,
        name,
        city: 'Ho Chi Minh City',
        address: '',
        contact: 'demo@example.test',
        description: 'studioDescription',
      });
      state.members.push(
        ...(['manager', 'photographer', 'photographer2'] as const).map((person) => ({
          studio: provider,
          person,
          role: person === 'manager' ? ('manager' as const) : ('photographer' as const),
        })),
      );
    }
  }
  function assignment(value: DemoBooking, person: string) {
    validateBrief(currentBrief(value), state.clock, true);
    requireRule(
      state.members.some((member) => member.studio === value.provider && member.person === person),
      'notMember',
    );
    requireRule(isAvailable(state, person, currentBrief(value), value.id), 'scheduleConflict');
  }
  switch (action.type) {
    case 'book': {
      requireRule(actor === 'client');
      const availableService =
        state.services.find((service) => service.id === action.service.id) ?? action.service;
      requireRule(
        availableService.published && availableService.owner === action.provider,
        'serviceUnavailable',
      );
      representProvider(action.provider, action.providerType, action.providerName);
      validateBrief(action.brief, state.clock, true);
      requireRule(!state.bookings.some((value) => value.id === action.id), 'duplicate');
      state.bookings.unshift({
        id: action.id,
        client: actor,
        provider: action.provider,
        providerType: action.providerType,
        providerName: action.providerName,
        service: structuredClone(availableService),
        status: 'pending',
        briefs: [{ ...action.brief, version: 1, clientApproved: true, providerApproved: false }],
        agreedVersion: null,
        assigned: null,
        roomId: null,
        version: 1,
        cancellation: null,
        milestones: [],
        decisions: [],
        gallery: [],
        round: 0,
        selections: [],
        deliveries: [],
        deliveredAt: null,
        remainingMs: 168 * 3600000,
        hold: false,
        holdReason: '',
      });
      notify(
        state,
        action.providerType === 'studio'
          ? 'manager'
          : (state.representatives[action.provider] ?? action.provider),
        'newBooking',
        `/bookings/${action.id}`,
      );
      break;
    }
    case 'brief': {
      const value = visibleBooking();
      requireRule(actor === value.client || canManageBooking(state, actor, value));
      requireRule(['pending', 'confirmed', 'in_progress'].includes(value.status), 'stateLocked');
      validateBrief(action.brief, state.clock, true);
      value.briefs.push({
        ...action.brief,
        version: currentBrief(value).version + 1,
        clientApproved: actor === value.client,
        providerApproved: actor !== value.client,
        rejection: undefined,
      });
      value.version++;
      break;
    }
    case 'approve': {
      const value = visibleBooking();
      requireRule(['pending', 'confirmed', 'in_progress'].includes(value.status), 'stateLocked');
      requireRule(actor === value.client || canManageBooking(state, actor, value));
      const brief = currentBrief(value);
      requireRule(!brief.rejection, 'stateLocked');
      if (actor === value.client) brief.clientApproved = true;
      else brief.providerApproved = true;
      if (brief.clientApproved && brief.providerApproved) {
        if (value.status !== 'pending')
          requireRule(
            isAvailable(state, value.assigned ?? value.provider, brief, value.id),
            'scheduleConflict',
          );
        value.agreedVersion = brief.version;
      }
      value.version++;
      break;
    }
    case 'brief-reject': {
      const value = visibleBooking();
      requireRule(['pending', 'confirmed', 'in_progress'].includes(value.status), 'stateLocked');
      requireRule(actor === value.client || canManageBooking(state, actor, value));
      const brief = currentBrief(value);
      requireRule(
        !brief.rejection &&
          brief.version !== value.agreedVersion &&
          !(actor === value.client ? brief.clientApproved : brief.providerApproved),
        'stateLocked',
      );
      requireRule(action.reason.trim(), 'reasonRequired');
      brief.rejection = { by: actor, reason: action.reason.trim() };
      value.version++;
      break;
    }
    case 'assign': {
      requireRule(!currentBrief(visibleBooking()).rejection, 'stateLocked');
      const value = visibleBooking();
      manager(value.provider);
      requireRule(
        value.providerType === 'studio' && action.expectedVersion === value.version,
        'staleVersion',
      );
      const initial = value.status === 'pending' && !value.assigned;
      requireRule(
        initial || (Boolean(value.assigned) && ['confirmed', 'in_progress'].includes(value.status)),
        'assignmentState',
      );
      requireRule(
        currentBrief(value).clientApproved && currentBrief(value).providerApproved,
        'briefApprovals',
      );
      if (!initial) requireRule(action.reason.trim(), 'reasonRequired');
      assignment(value, action.person);
      value.assigned = action.person;
      value.version++;
      notify(state, action.person, 'assignmentUpdated', `/bookings/${value.id}`);
      break;
    }
    case 'confirm': {
      const value = visibleBooking();
      requireRule(canManageBooking(state, actor, value));
      if (value.status === 'confirmed' && value.roomId) return original;
      requireRule(value.status === 'pending', 'stateLocked');
      requireRule(!currentBrief(value).rejection, 'stateLocked');
      validateBrief(currentBrief(value), state.clock, true);
      requireRule(
        currentBrief(value).clientApproved && currentBrief(value).providerApproved,
        'briefApprovals',
      );
      if (value.providerType === 'studio') {
        requireRule(value.assigned, 'assignmentRequired');
        assignment(value, value.assigned);
      } else
        requireRule(
          isAvailable(state, value.provider, currentBrief(value), value.id),
          'scheduleConflict',
        );
      value.status = 'confirmed';
      value.roomId = `room-${value.id}`;
      value.agreedVersion = currentBrief(value).version;
      value.version++;
      notify(state, value.client, 'bookingConfirmed', `/bookings/${value.id}`);
      break;
    }
    case 'start': {
      const value = worker();
      requireRule(value.status === 'confirmed', 'stateLocked');
      value.status = 'in_progress';
      value.version++;
      break;
    }
    case 'reject': {
      const value = visibleBooking();
      requireRule(canManageBooking(state, actor, value) && value.status === 'pending');
      requireRule(action.reason.trim(), 'reasonRequired');
      value.status = 'rejected';
      value.version++;
      break;
    }
    case 'cancel': {
      const value = visibleBooking();
      requireRule(actor === value.client || canWorkBooking(state, actor, value));
      requireRule(action.reason.trim(), 'reasonRequired');
      if (value.status === 'pending') {
        requireRule(actor === value.client);
        value.status = 'cancelled';
      } else {
        requireRule(['confirmed', 'in_progress', 'proofing'].includes(value.status), 'stateLocked');
        requireRule(!value.cancellation, 'duplicate');
        value.cancellation = { by: actor, reason: action.reason.trim() };
      }
      value.version++;
      break;
    }
    case 'cancel-agree':
    case 'cancel-decline': {
      const value = visibleBooking();
      requireRule(
        value.cancellation && ['confirmed', 'in_progress', 'proofing'].includes(value.status),
        'stateLocked',
      );
      requireRule(actor === value.client || canWorkBooking(state, actor, value));
      requireRule(
        (value.cancellation.by === value.client) !== (actor === value.client),
        'counterpartyRequired',
      );
      if (action.type === 'cancel-agree') value.status = 'cancelled';
      value.cancellation = null;
      value.version++;
      break;
    }
    case 'conversation': {
      const context = state.bookings.find((value) => value.id === action.booking);
      requireRule(
        actor === 'client' ||
          (context &&
            canUseRoom(state, actor, context) &&
            context.provider === action.provider &&
            context.providerType === action.providerType),
      );
      const client = actor === 'client' ? actor : context!.client;
      representProvider(action.provider, action.providerType, action.providerName);
      if (
        state.conversations.some(
          (value) =>
            value.client === client &&
            value.provider === action.provider &&
            value.providerType === action.providerType,
        )
      )
        return original;
      state.conversations.unshift({
        id: action.id,
        client,
        provider: action.provider,
        providerType: action.providerType,
        providerName: action.providerName,
      });
      break;
    }
    case 'message': {
      const conversation = state.conversations.find((value) => value.id === action.conversation);
      requireRule(conversation && canReadMessage(state, actor, conversation, action.booking));
      if (action.booking) {
        const context = state.bookings.find((value) => value.id === action.booking);
        requireRule(context && canUseRoom(state, actor, context), 'roomClosed');
      }
      requireRule(action.text.trim() || action.file, 'messageRequired');
      if (action.file) validateDemoFile(action.file);
      if (
        state.messages.some(
          (message) => message.sender === actor && message.submission === action.submission,
        )
      )
        return original;
      state.messages.push({
        id: action.id,
        conversation: action.conversation,
        booking: action.booking,
        sender: actor,
        text: action.text.trim(),
        file: action.file,
        submission: action.submission,
        at: state.clock,
      });
      break;
    }
    case 'milestone': {
      const value = visibleBooking();
      requireRule(canUseRoom(state, actor, value), 'roomClosed');
      requireRule(action.title.trim(), 'invalidInput');
      value.milestones.push({
        id: id(state, 'milestone'),
        title: action.title.trim(),
        done: false,
      });
      break;
    }
    case 'milestone-done': {
      const value = visibleBooking();
      requireRule(canUseRoom(state, actor, value), 'roomClosed');
      const milestone = value.milestones.find((item) => item.id === action.milestone);
      requireRule(milestone, 'notFound');
      milestone.done = !milestone.done;
      break;
    }
    case 'decision': {
      const value = visibleBooking();
      requireRule(canUseRoom(state, actor, value), 'roomClosed');
      requireRule(action.text.trim(), 'invalidInput');
      value.decisions.push({
        id: id(state, 'decision'),
        text: action.text.trim(),
        by: actor,
        result: 'proposed',
      });
      break;
    }
    case 'decision-result': {
      const value = visibleBooking();
      requireRule(canUseRoom(state, actor, value), 'roomClosed');
      const decision = value.decisions.find((item) => item.id === action.decision);
      requireRule(
        decision && decision.by !== actor && decision.result === 'proposed',
        'counterpartyRequired',
      );
      decision.result = action.result;
      break;
    }
    case 'gallery': {
      const value = worker();
      requireRule(
        ['in_progress', 'proofing'].includes(value.status) && !selectionSubmitted(value),
        'stateLocked',
      );
      requireRule(action.photos.length, 'imageRequired');
      action.photos.forEach((photo) => {
        validateDemoFile(photo);
        requireRule(photo.mime.startsWith('image/'), 'fileType');
      });
      value.gallery.push(...action.photos);
      value.round ||= 1;
      value.status = 'proofing';
      value.version++;
      break;
    }
    case 'select': {
      const value = visibleBooking();
      requireRule(
        actor === value.client && value.status === 'proofing' && !selectionSubmitted(value),
        'stateLocked',
      );
      requireRule(
        action.ids.length > 0 &&
          new Set(action.ids).size === action.ids.length &&
          action.ids.length <= agreedBrief(value).quota,
        'selectionQuota',
      );
      requireRule(
        action.ids.every((imageId) =>
          value.gallery.some((photo) => photo.id === imageId && !photo.hidden),
        ),
        'invalidInput',
      );
      requireRule(
        action.pins.every(
          (pin) =>
            value.gallery.some((photo) => photo.id === pin.imageId) &&
            pin.x >= 0 &&
            pin.x <= 100 &&
            pin.y >= 0 &&
            pin.y <= 100 &&
            pin.note.trim(),
        ),
        'invalidInput',
      );
      value.selections.push({
        round: value.round,
        ids: action.ids,
        note: action.note,
        pins: action.pins,
      });
      break;
    }
    case 'reopen': {
      const value = worker();
      requireRule(value.status === 'proofing' && selectionSubmitted(value), 'stateLocked');
      requireRule(value.round - 1 < agreedBrief(value).revisions, 'revisionLimit');
      value.round++;
      value.deliveries = [];
      break;
    }
    case 'delivery': {
      const value = worker();
      requireRule(value.status === 'proofing' && selectionSubmitted(value), 'selectionRequired');
      validateDemoFile(action.file);
      value.deliveries.push(action.file);
      break;
    }
    case 'deliver': {
      const value = worker();
      requireRule(
        value.status === 'proofing' && value.deliveries.length && selectionSubmitted(value),
        'deliveryRequired',
      );
      value.status = 'delivered';
      value.deliveredAt = state.clock;
      value.remainingMs = 168 * 3600000;
      value.version++;
      break;
    }
    case 'complete': {
      const value = visibleBooking();
      requireRule(
        actor === value.client && value.status === 'delivered' && !value.hold,
        'stateLocked',
      );
      value.status = 'completed';
      value.version++;
      break;
    }
    case 'review': {
      const value = visibleBooking();
      requireRule(actor === value.client && value.status === 'completed', 'reviewEligibility');
      requireRule(
        Number.isInteger(action.rating) &&
          action.rating >= 1 &&
          action.rating <= 5 &&
          action.comment.length <= 1000,
        'reviewInvalid',
      );
      const review = state.reviews.find((item) => item.booking === value.id);
      if (review) {
        requireRule(review.hidden && !review.deleted, 'reviewExists');
        review.rating = action.rating;
        review.comment = action.comment;
        review.reassessment = true;
      } else
        state.reviews.push({
          id: `review-${value.id}`,
          booking: value.id,
          rating: action.rating,
          comment: action.comment,
          hidden: false,
          deleted: false,
          reassessment: false,
          reason: '',
        });
      break;
    }
    case 'report': {
      requireRule(actor === 'client' || isPhotographer(actor));
      requireRule(
        action.reason.trim() && action.target && action.details.length <= 2000,
        'invalidInput',
      );
      requireRule(!state.hiddenTargets.includes(action.target), 'notFound');
      const album = state.albums.find(
        (value) =>
          value.id === action.target || value.photos.some((photo) => photo.id === action.target),
      );
      const review = state.reviews.find((value) => value.id === action.target);
      if (album)
        requireRule(
          album.published && !album.hidden && !state.hiddenTargets.includes(album.id),
          'notFound',
        );
      if (review) requireRule(!review.hidden && !review.deleted, 'notFound');
      requireRule(!state.reports.some((value) => value.id === action.id), 'duplicate');
      state.reports.unshift({ ...action, reporter: actor, status: 'pending', decision: '' });
      break;
    }
    case 'moderate': {
      requireRule(actor === 'admin');
      requireRule(action.reason.trim(), 'reasonRequired');
      const report = state.reports.find((item) => item.id === action.id);
      requireRule(report, 'notFound');
      report.status = action.outcome;
      report.decision = action.reason;
      if (action.outcome === 'actioned') {
        if (!state.hiddenTargets.includes(report.target)) state.hiddenTargets.push(report.target);
        const review = state.reviews.find((item) => item.id === report.target);
        if (review) {
          review.hidden = true;
          review.reason = action.reason;
        }
      }
      break;
    }
    case 'review-visibility': {
      requireRule(actor === 'admin');
      requireRule(action.reason.trim(), 'reasonRequired');
      const review = state.reviews.find((item) => item.id === action.id);
      requireRule(review && !review.deleted, 'notFound');
      requireRule(review.hidden && review.reassessment, 'stateLocked');
      review.hidden = !action.visible;
      review.reassessment = false;
      review.reason = action.reason;
      state.hiddenTargets = state.hiddenTargets.filter((value) => value !== review.id);
      if (!action.visible) state.hiddenTargets.push(review.id);
      break;
    }
    case 'hold': {
      requireRule(actor === 'admin');
      requireRule(booking && booking.status === 'delivered', 'stateLocked');
      requireRule(action.reason.trim(), 'reasonRequired');
      if (booking.hold === action.hold) return original;
      if (action.hold && !booking.hold)
        booking.remainingMs = Math.max(
          0,
          booking.remainingMs - (state.clock - (booking.deliveredAt ?? state.clock)),
        );
      booking.hold = action.hold;
      booking.holdReason = action.reason;
      booking.deliveredAt = action.hold ? null : state.clock;
      break;
    }
    case 'advance': {
      requireRule(actor === 'admin' && action.hours > 0 && action.hours <= 168);
      state.clock += action.hours * 3600000;
      for (const value of state.bookings)
        if (value.status === 'delivered' && !value.hold) {
          value.remainingMs = Math.max(
            0,
            value.remainingMs - (state.clock - (value.deliveredAt ?? state.clock)),
          );
          value.deliveredAt = state.clock;
          if (value.remainingMs === 0) {
            value.status = 'completed';
            value.version++;
            audit(state, 'system', 'autoComplete', value.id);
          }
        }
      break;
    }
    case 'studio': {
      requireRule(isPhotographer(actor));
      requireRule(
        action.studio.name.trim() && action.studio.city.trim() && action.studio.contact.trim(),
        'invalidInput',
      );
      requireRule(!state.studios.some((value) => value.id === action.studio.id), 'duplicate');
      state.studios.push(action.studio);
      state.members.push({ studio: action.studio.id, person: actor, role: 'manager' });
      break;
    }
    case 'studio-update': {
      manager(action.studio.id);
      requireRule(action.studio.name.trim() && action.studio.contact.trim(), 'invalidInput');
      const index = state.studios.findIndex((value) => value.id === action.studio.id);
      requireRule(index >= 0, 'notFound');
      state.studios[index] = action.studio;
      break;
    }
    case 'invite': {
      manager(action.studio);
      requireRule(
        isPhotographer(action.person as DemoRole) && state.profiles[action.person],
        'notMember',
      );
      requireRule(
        !state.members.some(
          (value) => value.studio === action.studio && value.person === action.person,
        ) &&
          !state.invitations.some(
            (value) =>
              value.studio === action.studio &&
              value.person === action.person &&
              value.status === 'pending',
          ),
        'duplicateInvitation',
      );
      state.invitations.push({ ...action, status: 'pending' });
      notify(state, action.person, 'newInvitation', '/studio');
      break;
    }
    case 'invitation': {
      const invitation = state.invitations.find((value) => value.id === action.id);
      requireRule(invitation?.person === actor && invitation.status === 'pending');
      invitation.status = action.accept ? 'accepted' : 'declined';
      if (action.accept)
        state.members.push({ studio: invitation.studio, person: actor, role: invitation.role });
      break;
    }
    case 'member': {
      if (!(action.person === actor && action.role === 'remove')) manager(action.studio);
      const member = state.members.find(
        (value) => value.studio === action.studio && value.person === action.person,
      );
      requireRule(member, 'notMember');
      if (member.role === 'manager' && action.role !== 'manager')
        requireRule(
          state.members.filter(
            (value) => value.studio === action.studio && value.role === 'manager',
          ).length > 1,
          'lastManager',
        );
      if (action.role === 'remove') {
        requireRule(
          !state.bookings.some(
            (value) =>
              value.provider === action.studio &&
              value.assigned === action.person &&
              !['cancelled', 'rejected', 'completed'].includes(value.status),
          ),
          'activeAssignment',
        );
        state.members = state.members.filter((value) => value !== member);
      } else member.role = action.role;
      break;
    }
    case 'service': {
      const service = action.service;
      requireRule(ownsProvider(state, actor, service.owner));
      requireRule(
        service.name.trim() &&
          service.price >= 0 &&
          service.duration >= 15 &&
          service.photos > 0 &&
          service.retouched >= 0 &&
          service.retouched <= service.photos &&
          service.quota > 0 &&
          service.quota <= service.photos &&
          service.revisions >= 0 &&
          Number.isFinite(service.price) &&
          [
            service.duration,
            service.photos,
            service.retouched,
            service.quota,
            service.revisions,
          ].every(Number.isInteger),
        'invalidInput',
      );
      const existing = state.services.find((value) => value.id === service.id);
      if (existing) {
        requireRule(existing.owner === service.owner);
        Object.assign(existing, service);
      } else state.services.push(service);
      break;
    }
    case 'album': {
      const album = action.album;
      requireRule(ownsProvider(state, actor, album.owner));
      requireRule(album.title.trim() && (!album.published || album.photos.length), 'imageRequired');
      album.photos.forEach((photo) => {
        validateDemoFile(photo);
        requireRule(photo.mime.startsWith('image/'), 'fileType');
      });
      const existing = state.albums.find((value) => value.id === album.id);
      if (existing) {
        requireRule(existing.owner === album.owner);
        Object.assign(existing, album);
      } else state.albums.push(album);
      break;
    }
    case 'resource': {
      manager(action.resource.studio);
      requireRule(action.resource.name.trim(), 'invalidInput');
      const existing = state.resources.find((value) => value.id === action.resource.id);
      if (existing) {
        requireRule(existing.studio === action.resource.studio);
        Object.assign(existing, action.resource);
      } else state.resources.push(action.resource);
      break;
    }
    case 'block': {
      requireRule(ownsProvider(state, actor, action.block.owner));
      requireRule(
        action.block.title.trim() && Date.parse(action.block.end) > Date.parse(action.block.start),
        'invalidSchedule',
      );
      const brief = {
        startsAt: action.block.start,
        endsAt: action.block.end,
      };
      requireRule(isAvailable(state, action.block.owner, brief), 'scheduleConflict');
      state.blocks.push(action.block);
      break;
    }
    case 'block-remove': {
      const block = state.blocks.find((value) => value.id === action.id);
      requireRule(block && ownsProvider(state, actor, block.owner));
      state.blocks = state.blocks.filter((value) => value.id !== action.id);
      break;
    }
    case 'profile': {
      requireRule(
        state.profiles[actor] && action.profile.name.trim() && action.profile.genres.length <= 5,
        'invalidInput',
      );
      state.profiles[actor] = action.profile;
      break;
    }
    case 'project': {
      requireRule(actor === 'client');
      requireRule(action.project.title.trim(), 'invalidInput');
      action.project.references.forEach(validateDemoFile);
      const existing = state.projects.find((value) => value.id === action.project.id);
      if (existing) Object.assign(existing, action.project);
      else state.projects.push(action.project);
      break;
    }
    case 'project-reference': {
      requireRule(actor === 'client');
      const project = state.projects.find((value) => value.id === action.id);
      requireRule(project, 'notFound');
      validateDemoFile(action.file);
      project.references.push(action.file);
      break;
    }
    case 'notification': {
      const notification = state.notifications.find((value) => value.id === action.id);
      requireRule(notification?.recipient === actor);
      notification.read = true;
      break;
    }
  }
  if (
    booking &&
    [
      'brief',
      'brief-reject',
      'approve',
      'reject',
      'cancel',
      'cancel-agree',
      'cancel-decline',
      'select',
      'deliver',
      'complete',
      'review',
    ].includes(action.type)
  ) {
    const recipients =
      actor !== booking.client
        ? [booking.client]
        : booking.providerType === 'studio'
          ? state.members
              .filter((member) => member.studio === booking.provider && member.role === 'manager')
              .map((member) => member.person)
          : [state.representatives[booking.provider] ?? booking.provider];
    for (const recipient of new Set(recipients))
      notify(state, recipient, 'bookingUpdated', `/bookings/${booking.id}`);
  }
  if (action.type === 'report') notify(state, 'admin', 'report', '/admin');
  if (action.type === 'moderate') {
    const report = state.reports.find((value) => value.id === action.id)!;
    notify(state, report.reporter, 'moderate', '/notifications');
  }
  if (action.type === 'invitation') {
    const invitation = state.invitations.find((value) => value.id === action.id)!;
    for (const member of state.members.filter(
      (value) => value.studio === invitation.studio && value.role === 'manager',
    ))
      notify(state, member.person, 'invitation', '/studio');
  }
  if (action.type === 'member') notify(state, action.person, 'memberUpdated', '/studio');
  audit(
    state,
    actor,
    action.type,
    'id' in action && state.bookings.some((value) => value.id === action.id)
      ? action.id
      : undefined,
    'reason' in action ? action.reason : '',
  );
  if (action.type === 'assign')
    state.history[0].assignment = {
      from: original.bookings.find((value) => value.id === action.id)?.assigned ?? null,
      to: action.person,
    };
  return state;
}
