import type { DemoBooking, DemoConversation, DemoRole, DemoState } from './types';

export const isPhotographer = (role: DemoRole) =>
  ['photographer', 'photographer2', 'manager'].includes(role);
export const isManager = (state: DemoState, actor: string, studio: string) =>
  state.members.some(
    (member) => member.studio === studio && member.person === actor && member.role === 'manager',
  );
export function ownsProvider(state: DemoState, actor: DemoRole, owner: string) {
  return (
    (isPhotographer(actor) && (owner === actor || state.representatives[owner] === actor)) ||
    isManager(state, actor, owner)
  );
}
export function canReadBooking(state: DemoState, actor: DemoRole, booking: DemoBooking) {
  return (
    actor === booking.client ||
    ownsProvider(state, actor, booking.provider) ||
    (booking.assigned === actor &&
      state.members.some((member) => member.studio === booking.provider && member.person === actor))
  );
}
export function canManageBooking(state: DemoState, actor: DemoRole, booking: DemoBooking) {
  return ownsProvider(state, actor, booking.provider);
}
export function canWorkBooking(state: DemoState, actor: DemoRole, booking: DemoBooking) {
  return (
    canManageBooking(state, actor, booking) ||
    (booking.assigned === actor && canReadBooking(state, actor, booking))
  );
}
export const canUseRoom = (state: DemoState, actor: DemoRole, booking: DemoBooking) =>
  Boolean(
    booking.roomId &&
    canReadBooking(state, actor, booking) &&
    ['confirmed', 'in_progress'].includes(booking.status),
  );
export function canReadConversation(
  state: DemoState,
  actor: DemoRole,
  conversation: DemoConversation,
) {
  return (
    actor === conversation.client ||
    ownsProvider(state, actor, conversation.provider) ||
    state.bookings.some(
      (booking) =>
        booking.client === conversation.client &&
        booking.provider === conversation.provider &&
        booking.providerType === conversation.providerType &&
        booking.assigned === actor &&
        Boolean(booking.roomId) &&
        canReadBooking(state, actor, booking),
    )
  );
}
export function canReadMessage(
  state: DemoState,
  actor: DemoRole,
  conversation: DemoConversation,
  bookingId: string | null,
) {
  if (!canReadConversation(state, actor, conversation)) return false;
  if (!bookingId)
    return actor === conversation.client || ownsProvider(state, actor, conversation.provider);
  const booking = state.bookings.find((item) => item.id === bookingId);
  return Boolean(
    booking &&
    booking.client === conversation.client &&
    booking.provider === conversation.provider &&
    booking.providerType === conversation.providerType &&
    canReadBooking(state, actor, booking),
  );
}
export function getNavigation(role: DemoRole) {
  if (role === 'guest') return ['explore'] as const;
  if (role === 'admin') return ['admin', 'explore'] as const;
  if (role === 'client') return ['explore', 'projects', 'bookings', 'messages'] as const;
  return ['bookings', 'messages', 'portfolio', 'studio', 'explore'] as const;
}
