import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { Client } = requireApi('pg');
const { createClient } = requireApi('@supabase/supabase-js');
const { bookingWorkspaceSchema, runtimeConfigSchema } =
  await import('../packages/shared/dist/index.js');
process.loadEnvFile('.env');
assert.equal(process.env.FRAME_ROOM_E2E_LOCAL_PROJECT, 'frameroom-atelier-verification');
assert.equal(new URL(process.env.DATABASE_URL).port, '56322');
assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
assert.equal(process.env.SUPABASE_URL, 'http://127.0.0.1:56321');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const result = {};
try {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const login = await auth.auth.signInWithPassword({
    email: process.env.FRAME_ROOM_E2E_CLIENT_EMAIL,
    password: process.env.FRAME_ROOM_E2E_PASSWORD,
  });
  assert.equal(login.error, null);
  const api = async (path) => {
    const response = await fetch(`http://localhost:4000${path}`, {
      headers: { authorization: `Bearer ${login.data.session.access_token}` },
    });
    assert.equal(response.status, 200);
    return (await response.json()).data;
  };
  runtimeConfigSchema.parse(await api('/v1/config'));
  const bookings = await api('/v1/bookings');
  for (const booking of bookings)
    bookingWorkspaceSchema.parse(await api(`/v1/bookings/${booking.id}/workspace`));
  result.typedWorkspaces = bookings.length;
  const managerLogin = await auth.auth.signInWithPassword({
    email: process.env.FRAME_ROOM_E2E_MANAGER_EMAIL,
    password: process.env.FRAME_ROOM_E2E_PASSWORD,
  });
  assert.equal(managerLogin.error, null);
  for (const path of ['/v1/me/studios', '/v1/photographers/me', '/v1/me/services']) {
    const response = await fetch(`http://localhost:4000${path}`, {
      headers: { authorization: `Bearer ${managerLogin.data.session.access_token}` },
    });
    assert.equal(response.status, 200, `Professional endpoint failed: ${path}`);
    const data = (await response.json()).data;
    if (path === '/v1/me/studios') {
      assert.ok(data.length);
      assert.ok(data.every((studio) => Array.isArray(studio.genres)));
    }
    if (path === '/v1/photographers/me') assert.ok(Array.isArray(data.genres));
  }
  result.professionalEnumArrays = 'passed';

  await db.query('begin');
  const row = (
    await db.query(
      "select b.* from public.bookings b where status='completed' and exists(select 1 from public.deliveries where booking_id=b.id) order by b.updated_at desc limit 1 for update",
    )
  ).rows[0];
  assert.ok(row, 'A completed synthetic browser booking is required.');
  await db.query("update public.bookings set status='delivered' where id=$1", [row.id]);
  let booking = (await db.query('select * from public.bookings where id=$1', [row.id])).rows[0];
  const hours = (Date.parse(booking.completion_due_at) - Date.now()) / 3600000;
  assert.ok(hours > 167.99 && hours <= 168.01);
  const admin = (
    await db.query("select user_id from public.user_roles where role='system_admin' limit 1")
  ).rows[0].user_id;
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: admin, role: 'authenticated' }),
  ]);
  booking = (
    await db.query(
      "select * from public.frameroom_set_completion_hold($1,true,$2,'Atelier verification')",
      [row.id, booking.version],
    )
  ).rows[0];
  assert.ok(booking.completion_hold_at);
  assert.equal(booking.completion_due_at, null);
  await db.query("select set_config('request.jwt.claims','{}',true)");
  await db.query('select public.frameroom_complete_due_bookings()');
  assert.equal(
    (await db.query('select status from bookings where id=$1', [row.id])).rows[0].status,
    'delivered',
  );
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: admin, role: 'authenticated' }),
  ]);
  booking = (
    await db.query(
      "select * from public.frameroom_set_completion_hold($1,false,$2,'Atelier verification release')",
      [row.id, booking.version],
    )
  ).rows[0];
  assert.equal(booking.completion_hold_at, null);
  assert.ok(booking.completion_due_at);
  await db.query("select set_config('request.jwt.claims','{}',true)");
  await db.query("update bookings set completion_due_at=now()-interval '1 second' where id=$1", [
    row.id,
  ]);
  await db.query('select public.frameroom_complete_due_bookings()');
  assert.equal(
    (await db.query('select status from bookings where id=$1', [row.id])).rows[0].status,
    'completed',
  );
  assert.equal(
    (await db.query('select status from shoot_rooms where booking_id=$1', [row.id])).rows[0].status,
    'closed',
  );
  assert.ok(
    (
      await db.query(
        "select id from private.booking_completion_events where booking_id=$1 and event='auto_completed'",
        [row.id],
      )
    ).rowCount,
  );
  const columns = (
    await db.query(
      "select column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='room_milestones'",
    )
  ).rows;
  assert.ok(!columns.some((c) => c.column_name === 'replay_updated_at'));
  assert.equal(columns.find((c) => c.column_name === 'updated_at').is_nullable, 'NO');
  assert.ok(columns.find((c) => c.column_name === 'updated_at').column_default.includes('now()'));
  result.completionDeadlineAndHold = 'passed';
  result.systemAutoCompletion = 'passed';
  result.migrationBridge = 'passed';
  await db.query('rollback');
  await fs.writeFile('.artifacts/atelier-database-result.json', JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await db.query('rollback');
  await db.end();
}
