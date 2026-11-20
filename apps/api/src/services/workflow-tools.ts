import type { z } from 'zod';
import {
  briefContentSchema,
  milestoneInputSchema,
  type Booking,
  type SavedProvider,
  type ShootCalendar,
  type Notification,
  type calendarRangeSchema,
  type savedProviderInputSchema,
} from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { requireCondition } from '../lib/errors.js';
import { milestone, openRoom } from './collaboration.js';

const savedProjection =
  "id, case when photographer_id is not null then 'photographer' else 'studio' end as provider_type, coalesce(photographer_id,studio_id) as provider_id, created_at";
export function listSavedProviders(tx: Transaction, userId: string) {
  return tx.rows<SavedProvider>(
    `select ${savedProjection} from saved_providers where user_id=$1 and private.provider_visible(photographer_id,studio_id) order by created_at desc,id`,
    [userId],
  );
}
export async function saveProvider(
  tx: Transaction,
  userId: string,
  input: z.infer<typeof savedProviderInputSchema>,
) {
  const photographer = input.providerType === 'photographer' ? input.providerId : null;
  const studio = input.providerType === 'studio' ? input.providerId : null;
  const row = await tx.one<{ visible: boolean }>(
    'select private.provider_visible($1,$2) as visible',
    [photographer, studio],
  );
  requireCondition(row.visible, 404, 'not_found');
  const column = input.providerType === 'photographer' ? 'photographer_id' : 'studio_id';
  return tx.one<SavedProvider>(
    `insert into saved_providers(user_id,${column}) values($1,$2)
    on conflict(user_id,${column}) do update set updated_at=now() returning ${savedProjection}`,
    [userId, input.providerId],
  );
}
export async function removeSavedProvider(tx: Transaction, userId: string, id: string) {
  await tx.execute('delete from saved_providers where id=$1 and user_id=$2', [id, userId]);
  return undefined;
}
export async function readCalendar(tx: Transaction, range: z.infer<typeof calendarRangeSchema>) {
  const bookings = await tx.rows<Booking>(
    'select * from bookings where private.can_read_booking(id) and scheduled_start<$2 and scheduled_end>$1 order by scheduled_start,id',
    [range.from, range.to],
  );
  const blocks = await tx.rows<ShootCalendar['blocks'][number]>(
    `select e.id,e.label,lower(e.during) as starts_at,upper(e.during) as ends_at,e.resource_id
    from schedule_entries e where e.booking_id is null and e.during && tstzrange($1,$2,'[)')
    and (private.owns_provider(e.photographer_id,null) or exists(select 1 from studio_resources r where r.id=e.resource_id and private.is_manager(r.studio_id)))
    order by lower(e.during),e.id`,
    [range.from, range.to],
  );
  return { bookings, blocks };
}
export function markAllNotificationsRead(tx: Transaction, userId: string) {
  return tx.one<{ count: number }>(
    `with changed as (update notifications set read_at=now() where recipient_id=$1 and read_at is null returning id)
    select count(*)::int as count from changed`,
    [userId],
  );
}
export function notificationCounts(tx: Transaction, userId: string) {
  return tx.one<{ unread: number; total: number }>(
    'select count(*) filter(where read_at is null)::int as unread,count(*)::int as total from notifications where recipient_id=$1',
    [userId],
  );
}
export function notificationInbox(
  tx: Transaction,
  userId: string,
  state: 'all' | 'unread' | 'read',
) {
  return tx.rows<Notification>(
    "select * from notifications where recipient_id=$1 and ($2='all' or ($2='unread' and read_at is null) or ($2='read' and read_at is not null)) order by created_at desc,id desc limit 100",
    [userId, state],
  );
}
export async function importBriefChecklist(tx: Transaction, userId: string, roomId: string) {
  // openRoom locks the booking and room before reading/importing, serializing retries.
  const room = await openRoom(tx, roomId);
  const source = await tx.optional<{ content: unknown }>(
    `select v.content from brief_versions v join bookings b on b.id=v.booking_id
    where b.id=$1 and v.version=b.agreed_brief_version`,
    [room.bookingId],
  );
  requireCondition(source, 422, 'brief_required');
  const checklist = briefContentSchema.parse(source.content).checklist;
  const titles = [...new Set(checklist.map((title) => title.trim()).filter(Boolean))];
  const inputs = titles.map((title) => milestoneInputSchema.parse({ title, dueAt: null }));
  const existing = new Set(
    (
      await tx.rows<{ title: string }>('select title from room_milestones where room_id=$1', [
        roomId,
      ])
    ).map((item) => item.title.trim()),
  );
  let count = 0;
  for (const input of inputs) {
    if (existing.has(input.title)) continue;
    await milestone(tx, userId, roomId, input);
    count += 1;
  }
  return { count };
}
