import type { Booking } from '@frameroom/shared';
export function shootStage(status: Booking['status']) {
  return {
    pending: 1,
    confirmed: 2,
    in_progress: 2,
    proofing: 3,
    delivered: 4,
    completed: 5,
    rejected: -1,
    cancelled: -1,
  }[status];
}
