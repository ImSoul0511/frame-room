import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import pg from 'pg';
import { normalizeRow, type Transaction } from './repositories/database.js';
import { ApiError } from './lib/errors.js';
import {
  importBriefChecklist,
  listSavedProviders,
  markAllNotificationsRead,
  notificationCounts,
  notificationInbox,
  readCalendar,
  removeSavedProvider,
  saveProvider,
} from './services/workflow-tools.js';

// Supplemental local verification only. Every fixture change rolls back.
process.loadEnvFile('../../.env');
assert.equal(process.env.FRAME_ROOM_E2E_LOCAL_PROJECT, 'frameroom-atelier-verification');
assert.equal(new URL(process.env.DATABASE_URL!).hostname, '127.0.0.1');
assert.equal(new URL(process.env.DATABASE_URL!).port, '56322');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tx: Transaction = {
  async rows<T>(sql: string, values: unknown[] = []) {
    return normalizeRow((await db.query(sql, values)).rows) as T[];
  },
  async one<T>(sql: string, values: unknown[] = []) {
    const row = (await this.rows<T>(sql, values))[0];
    assert.ok(row);
    return row;
  },
  async optional<T>(sql: string, values: unknown[] = []) {
    return (await this.rows<T>(sql, values))[0];
  },
  async execute(sql: string, values: unknown[] = []) {
    await db.query(sql, values);
  },
};
const actor = (id: string) =>
  db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: id, role: 'authenticated' }),
  ]);
const result: Record<string, string> = {};
async function denied(action: () => Promise<unknown>, matches: (error: unknown) => boolean) {
  await db.query('savepoint denied');
  await assert.rejects(action, matches);
  await db.query('rollback to savepoint denied');
}
try {
  await db.query('begin');
  const user = async (email: string) =>
    (await tx.one<{ id: string }>('select id from auth.users where email=$1', [email])).id;
  const client = await user(process.env.FRAME_ROOM_E2E_CLIENT_EMAIL!);
  const outsider = await user(process.env.FRAME_ROOM_E2E_OUTSIDER_EMAIL!);
  const manager = await user(process.env.FRAME_ROOM_E2E_MANAGER_EMAIL!);
  const studio = await tx.one<{ id: string }>("select id from studios where name='Still Studio'");
  await db.query('delete from saved_providers where user_id=any($1::uuid[])', [[client, outsider]]);
  await actor(client);
  const saved = await saveProvider(tx, client, { providerType: 'studio', providerId: studio.id });
  const retry = await saveProvider(tx, client, { providerType: 'studio', providerId: studio.id });
  assert.equal(saved.id, retry.id);
  assert.equal((await listSavedProviders(tx, client)).length, 1);
  await actor(outsider);
  assert.equal((await listSavedProviders(tx, outsider)).length, 0);
  await removeSavedProvider(tx, outsider, saved.id);
  assert.equal((await listSavedProviders(tx, client)).length, 1);
  await db.query('set local role authenticated');
  assert.equal((await db.query('select * from saved_providers')).rowCount, 0);
  await actor(client);
  assert.equal((await db.query('select * from saved_providers')).rowCount, 1);
  await denied(
    () => db.query('delete from saved_providers'),
    (error) => (error as { code?: string }).code === '42501',
  );
  await db.query('reset role');
  await db.query('set local role anon');
  await denied(
    () => db.query('select * from saved_providers'),
    (error) => (error as { code?: string }).code === '42501',
  );
  await db.query('reset role');
  await db.query('update studios set is_hidden=true where id=$1', [studio.id]);
  assert.equal((await listSavedProviders(tx, client)).length, 0);
  await denied(
    () => saveProvider(tx, client, { providerType: 'studio', providerId: studio.id }),
    (error) => error instanceof ApiError && error.status === 404,
  );
  await db.query('update studios set is_hidden=false where id=$1', [studio.id]);
  result.savedOwnershipRlsAndHiddenTargets = 'passed';
  result.idempotentSave = 'passed';

  const booking = await tx.one<{ id: string; agreedBriefVersion: number }>(
    'select id,agreed_brief_version from bookings where client_id=$1 and studio_id=$2 and agreed_brief_version is not null and exists(select 1 from shoot_rooms where booking_id=bookings.id) order by created_at desc limit 1',
    [client, studio.id],
  );
  await db.query(
    "update bookings set scheduled_start='2099-01-01T23:00:00Z',scheduled_end='2099-01-02T02:00:00Z' where id=$1",
    [booking.id],
  );
  const resource = await tx.one<{ id: string }>(
    'select id from studio_resources where studio_id=$1 and deleted_at is null limit 1',
    [studio.id],
  );
  const block = await tx.one<{ id: string }>(
    "insert into schedule_entries(resource_id,during,label) values($1,tstzrange('2099-01-03T10:00:00Z','2099-01-03T11:00:00Z','[)'),'Private equipment block') returning id",
    [resource.id],
  );
  const range = { from: '2099-01-02T00:00:00Z', to: '2099-01-04T00:00:00Z' };
  await actor(client);
  const calendar = await readCalendar(tx, range);
  assert.ok(calendar.bookings.some((item) => item.id === booking.id));
  assert.ok(!calendar.blocks.some((item) => item.id === block.id));
  assert.ok(
    !(
      await readCalendar(tx, { from: '2099-01-02T02:00:00Z', to: '2099-01-02T03:00:00Z' })
    ).bookings.some((item) => item.id === booking.id),
  );
  await actor(outsider);
  assert.ok(!(await readCalendar(tx, range)).bookings.some((item) => item.id === booking.id));
  assert.ok(!(await readCalendar(tx, range)).blocks.some((item) => item.id === block.id));
  await actor(manager);
  const management = await readCalendar(tx, range);
  assert.ok(management.bookings.some((item) => item.id === booking.id));
  assert.ok(management.blocks.some((item) => item.id === block.id));
  result.calendarScopeOvernightAndBoundaries = 'passed';

  const notices = await tx.rows<{ id: string; recipientId: string }>(
    "insert into notifications(recipient_id,event) values($1,'booking_confirmed'),($2,'booking_confirmed') returning id,recipient_id",
    [client, outsider],
  );
  await markAllNotificationsRead(tx, client);
  assert.ok(
    (
      await tx.one<{ readAt: string }>('select read_at from notifications where id=$1', [
        notices.find((item) => item.recipientId === client)!.id,
      ])
    ).readAt,
  );
  assert.equal(
    (
      await tx.one<{ readAt: null }>('select read_at from notifications where id=$1', [
        notices.find((item) => item.recipientId === outsider)!.id,
      ])
    ).readAt,
    null,
  );
  assert.equal((await markAllNotificationsRead(tx, client)).count, 0);
  const oldNotice = await tx.one<{ id: string }>(
    "insert into notifications(recipient_id,event,created_at) values($1,'booking_confirmed',now()-interval '10 years') returning id",
    [client],
  );
  await db.query(
    "insert into notifications(recipient_id,event,read_at) select $1,'booking_confirmed',now() from generate_series(1,101)",
    [client],
  );
  assert.equal((await notificationCounts(tx, client)).unread, 1);
  assert.ok(
    (await notificationInbox(tx, client, 'unread')).some((item) => item.id === oldNotice.id),
  );
  assert.ok(!(await notificationInbox(tx, client, 'all')).some((item) => item.id === oldNotice.id));
  assert.equal((await markAllNotificationsRead(tx, client)).count, 1);
  assert.equal((await notificationCounts(tx, client)).unread, 0);
  result.bulkReadRecipientRetryAndOlderUnread = 'passed';

  await db.query("update bookings set status='confirmed' where id=$1", [booking.id]);
  const room = await tx.one<{ id: string }>(
    "update shoot_rooms set status='open' where booking_id=$1 returning id",
    [booking.id],
  );
  await db.query('delete from room_milestones where room_id=$1', [room.id]);
  await db.query(
    "update brief_versions set content=jsonb_set(content,'{checklist}',$3::jsonb) where booking_id=$1 and version=$2",
    [
      booking.id,
      booking.agreedBriefVersion,
      JSON.stringify(['Check lighting', 'Pack lenses', 'Check lighting', '  ']),
    ],
  );
  await actor(client);
  assert.equal((await importBriefChecklist(tx, client, room.id)).count, 2);
  assert.equal((await importBriefChecklist(tx, client, room.id)).count, 0);
  assert.equal(
    (await tx.rows('select id from room_milestones where room_id=$1', [room.id])).length,
    2,
  );
  await actor(outsider);
  await denied(
    () => importBriefChecklist(tx, outsider, room.id),
    (error) => error instanceof ApiError && [403, 404].includes(error.status),
  );
  await actor(client);
  await db.query(
    "update brief_versions set content=jsonb_set(content,'{checklist}',$3::jsonb) where booking_id=$1 and version=$2",
    [
      booking.id,
      booking.agreedBriefVersion,
      JSON.stringify(['Should not be added', 'x'.repeat(121)]),
    ],
  );
  await denied(
    () => importBriefChecklist(tx, client, room.id),
    (error) => error instanceof Error && error.name === 'ZodError',
  );
  assert.equal(
    (await tx.rows('select id from room_milestones where room_id=$1', [room.id])).length,
    2,
  );
  await db.query("update bookings set status='proofing' where id=$1", [booking.id]);
  await denied(
    () => importBriefChecklist(tx, client, room.id),
    (error) => error instanceof ApiError && [404, 422].includes(error.status),
  );
  result.checklistAgreedSourceIdempotencyAccessAndAtomicity = 'passed';
  await writeFile(
    '../../.artifacts/workflow-tools-database-result.json',
    JSON.stringify(result, null, 2),
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await db.query('rollback');
  await db.end();
}
