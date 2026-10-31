import type { Transaction } from '../repositories/database.js';
import { requireCondition } from '../lib/errors.js';
import type { Booking, CreativeProject } from '@frameroom/shared';

export async function access(
  tx: Transaction,
  kind: 'project' | 'booking' | 'room' | 'gallery',
  id: string,
) {
  const { allowed } = await tx.one<{ allowed: boolean }>(
    `select private.can_read_${kind}($1) as allowed`,
    [id],
  );
  requireCondition(allowed, 404, 'not_found');
}
export async function project(tx: Transaction, id: string, lock = false) {
  await access(tx, 'project', id);
  return tx.one<CreativeProject>(
    'select p.*, b.id as booking_id from creative_projects p left join bookings b on b.project_id=p.id where p.id=$1' +
      (lock ? ' for update of p' : ''),
    [id],
  );
}
export async function booking(tx: Transaction, id: string, lock = false) {
  await access(tx, 'booking', id);
  return tx.one<Booking>('select * from bookings where id=$1' + (lock ? ' for update' : ''), [id]);
}
export async function manageProvider(
  tx: Transaction,
  photographerId: string | null,
  studioId: string | null,
) {
  const row = await tx.one<{ allowed: boolean }>('select private.owns_provider($1,$2) as allowed', [
    photographerId,
    studioId,
  ]);
  requireCondition(row.allowed);
}
export async function providerSide(tx: Transaction, bookingId: string) {
  const row = await tx.one<{ allowed: boolean }>('select private.provider_side($1) as allowed', [
    bookingId,
  ]);
  requireCondition(row.allowed);
}
export async function manager(tx: Transaction, studioId: string) {
  await manageProvider(tx, null, studioId);
}
export async function admin(tx: Transaction) {
  const row = await tx.one<{ allowed: boolean }>('select private.is_admin() as allowed');
  requireCondition(row.allowed);
}
