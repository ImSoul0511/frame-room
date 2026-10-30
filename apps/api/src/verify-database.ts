import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './config/env.js';
import { Database, Transaction } from './repositories/database.js';
import { createProject } from './services/projects.js';
import {
  createBooking,
  transition,
  reschedule,
  createBrief,
  approveBrief,
} from './services/bookings.js';
import { submitSelection, review, sendMessage } from './services/collaboration.js';
import { confirmAction } from './services/ai-actions.js';
import { createProfile } from './services/providers.js';
import { claimForWork } from './repositories/ai-jobs.js';

const env = loadEnv();
if (!env.DATABASE_URL || new URL(env.DATABASE_URL).hostname !== '127.0.0.1')
  throw new Error('Verification is local-only.');
const db = new Database(env.DATABASE_URL);
let checks = 0;
const actor = async (tx: Transaction, id: string) =>
  tx.execute("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: id, role: 'authenticated' }),
  ]);
async function denied(tx: Transaction, fn: () => Promise<unknown>, expected?: string) {
  await tx.execute('savepoint rejection');
  let caught: unknown;
  try {
    await fn();
  } catch (error) {
    caught = error;
  }
  await tx.execute('rollback to savepoint rejection');
  await tx.execute('release savepoint rejection');
  assert.ok(caught, 'Expected operation to be rejected');
  if (expected)
    assert.ok(
      String((caught as Error).message).includes(expected),
      `${expected}: ${(caught as Error).message}`,
    );
  checks++;
}
try {
  // All fixtures and state changes are rolled back, preserving existing local work.
  await db
    .run(null, async (tx) => {
      const client = randomUUID(),
        manager = randomUUID(),
        photographer = randomUUID(),
        outsider = randomUUID();
      for (const [id, name] of [
        [client, 'client'],
        [manager, 'manager'],
        [photographer, 'photographer'],
        [outsider, 'outsider'],
      ]) {
        await tx.execute(
          'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
          [id, `${id}@frameroom.test`],
        );
        await createProfile(tx, id, {
          userName: `t_${id.replaceAll('-', '').slice(0, 20)}`,
          displayName: name,
        });
      }
      await actor(tx, client);
      const repeated = await createProfile(tx, client, {
        userName: 'ignored_retry_name',
        displayName: 'ignored',
      });
      assert.equal(repeated.created, false);
      assert.notEqual(repeated.data.userName, 'ignored_retry_name');
      checks++;
      const ph = await tx.one<{ id: string }>(
        "insert into photographers(user_id,display_name,genres) values($1,'Test photographer',array['portrait']::genre[]) returning id",
        [photographer],
      );
      const managerPh = await tx.one<{ id: string }>(
        "insert into photographers(user_id,display_name,genres) values($1,'Test manager',array['portrait']::genre[]) returning id",
        [manager],
      );
      const studio = await tx.one<{ id: string }>(
        "insert into studios(name,genres,created_by) values('Test studio',array['portrait']::genre[],$1) returning id",
        [manager],
      );
      await tx.execute(
        "insert into studio_members(studio_id,user_id,role) values($1,$2,'manager'),($1,$3,'photographer')",
        [studio.id, manager, photographer],
      );
      const resource = await tx.one<{ id: string }>(
        "insert into studio_resources(studio_id,name,type) values($1,'Test room','room') returning id",
        [studio.id],
      );
      const service = await tx.one<{ id: string }>(
        "insert into services(owner_type,studio_id,name,genre,duration_minutes,price) values('studio',$1,'Test shoot','portrait',120,1000) returning id",
        [studio.id],
      );
      const makeBooking = async () => {
        await actor(tx, client);
        const p = (await createProject(tx, client, {
          title: 'Permission test',
          idea: 'A natural portrait',
        })) as { id: string };
        return createBooking(tx, client, {
          projectId: p.id,
          serviceId: service.id,
          scheduledStart: '2036-11-10T03:00:00.000Z',
          scheduledEnd: '2036-11-10T05:00:00.000Z',
          addOnIds: [],
          note: '',
        });
      };
      let b = await makeBooking();
      const collision = await makeBooking();
      await actor(tx, outsider);
      await denied(
        tx,
        () => transition(tx, b.id, { to: 'confirmed', version: 1, reason: '', resourceIds: [] }),
        'forbidden',
      );
      await actor(tx, manager);
      b = await transition(tx, b.id, {
        to: 'confirmed',
        version: 1,
        reason: '',
        resourceIds: [resource.id],
        assignedPhotographerId: ph.id,
      });
      assert.equal(b.status, 'confirmed');
      checks++;
      await denied(tx, () =>
        transition(tx, collision.id, {
          to: 'confirmed',
          version: 1,
          reason: '',
          resourceIds: [resource.id],
          assignedPhotographerId: ph.id,
        }),
      );
      assert.equal(
        (
          await tx.one<{ status: string }>('select status from bookings where id=$1', [
            collision.id,
          ])
        ).status,
        'pending',
      );
      assert.equal(
        (await tx.rows('select id from schedule_entries where booking_id=$1', [collision.id]))
          .length,
        0,
      );
      checks++;
      await denied(
        tx,
        () =>
          transition(tx, b.id, {
            to: 'in_progress',
            version: b.version,
            reason: '',
            resourceIds: [],
          }),
        'brief_required',
      );
      const content = {
        title: 'Agreed portrait',
        concept: 'Natural light',
        shotList: ['Portrait'],
        lighting: ['Window'],
        checklist: ['Camera'],
        milestones: ['Shoot'],
      };
      await actor(tx, client);
      const brief = (await createBrief(tx, b.id, client, content)) as { id: string };
      await actor(tx, photographer);
      await approveBrief(tx, b.id, brief.id, photographer);
      b = await tx.one('select * from bookings where id=$1', [b.id]);
      assert.equal(b.agreedBriefVersion, 1);
      checks++;
      await actor(tx, outsider);
      await tx.execute('set local role authenticated');
      assert.equal((await tx.rows('select id from bookings where id=$1', [b.id])).length, 0);
      assert.equal(
        (await tx.rows('select id from creative_projects where id=$1', [b.projectId])).length,
        0,
      );
      await tx.execute('reset role');
      checks++;
      await actor(tx, client);
      await tx.execute('set local role authenticated');
      assert.equal((await tx.rows('select id from bookings where id=$1', [b.id])).length, 1);
      await denied(tx, () => tx.execute('update bookings set total_price=0 where id=$1', [b.id]));
      await tx.execute('reset role');
      checks++;
      await actor(tx, manager);
      await denied(
        tx,
        () =>
          tx.execute('delete from studio_members where studio_id=$1 and user_id=$2', [
            studio.id,
            photographer,
          ]),
        'active_assignment',
      );
      await denied(
        tx,
        () => {
          return tx
            .execute(
              "update studio_members set role='photographer' where studio_id=$1 and user_id=$2",
              [studio.id, manager],
            )
            .then(() => tx.execute('set constraints require_manager immediate'));
        },
        'last_manager',
      );
      b = await reschedule(tx, b.id, {
        version: b.version,
        scheduledStart: b.scheduledStart,
        scheduledEnd: b.scheduledEnd,
        assignedPhotographerId: managerPh.id,
        resourceIds: [resource.id],
      });
      await actor(tx, photographer);
      const access = await tx.one<{ allowed: boolean }>(
        'select private.can_read_booking($1) as allowed',
        [b.id],
      );
      assert.equal(access.allowed, false);
      await tx.execute('set local role authenticated');
      assert.equal(
        (await tx.rows('select id from shoot_rooms where booking_id=$1', [b.id])).length,
        0,
      );
      await tx.execute('reset role');
      checks++;
      await actor(tx, client);
      const a = await tx.one<{ id: string }>(
        "insert into ai_actions(project_id,proposed_for,kind,explanation,payload,project_version,booking_version) select p.id,$2,'update_brief','Test',$3,p.version,b.version from creative_projects p join bookings b on b.project_id=p.id where b.id=$1 returning id",
        [b.id, client, JSON.stringify({ brief: content })],
      );
      await tx.execute('update creative_projects set version=version+1 where id=$1', [b.projectId]);
      await denied(tx, () => confirmAction(tx, client, a.id), 'stale_action');
      await actor(tx, manager);
      b = await transition(tx, b.id, {
        to: 'in_progress',
        version: b.version,
        reason: '',
        resourceIds: [],
      });
      const gallery = await tx.one<{ id: string }>('select id from galleries where booking_id=$1', [
        b.id,
      ]);
      const image = await tx.one<{ id: string }>(
        'insert into gallery_images(gallery_id,storage_path,width,height) values($1,$2,200,200) returning id',
        [gallery.id, `${b.id}/${randomUUID()}.webp`],
      );
      b = await transition(tx, b.id, {
        to: 'proofing',
        version: b.version,
        reason: '',
        resourceIds: [],
      });
      await actor(tx, client);
      await submitSelection(tx, client, b.id, { imageIds: [image.id] });
      await actor(tx, manager);
      await tx.execute(
        "insert into deliveries(booking_id,storage_path,file_name,mime_type) values($1,$2,'final.webp','image/webp')",
        [b.id, `${b.id}/${randomUUID()}.webp`],
      );
      b = await transition(tx, b.id, {
        to: 'delivered',
        version: b.version,
        reason: '',
        resourceIds: [],
      });
      await actor(tx, client);
      b = await transition(tx, b.id, {
        to: 'completed',
        version: b.version,
        reason: '',
        resourceIds: [],
      });
      await review(tx, client, b.id, { rating: 5, comment: 'Verified journey' });
      checks++;
      await denied(tx, () => review(tx, client, b.id, { rating: 1, comment: 'Duplicate' }));
      const room = await tx.one<{ id: string }>('select id from shoot_rooms where booking_id=$1', [
        b.id,
      ]);
      await denied(
        tx,
        () => sendMessage(tx, client, room.id, { text: 'Should not send', storagePath: null }),
        'room_closed',
      );
      const spent = await tx.one<{ total: number }>(
        "select coalesce(sum(greatest(reserved_usd,coalesce(actual_usd,0))),0)::float as total from ai_usage where created_at>=date_trunc('month',now())",
      );
      if (spent.total < 10) {
        await tx.execute("select frameroom_reserve_usage($1,'test','test',20,0,30)", [client]);
        await denied(
          tx,
          () => tx.execute("select frameroom_reserve_usage($1,'test','test',20,0,30)", [client]),
          'ai_budget_exhausted',
        );
      }
      const queued = await tx.one<{ id: string }>(
        "insert into ai_jobs(user_id,kind,input,request_key) values($1,'index','{}',$2) returning id",
        [client, randomUUID()],
      );
      assert.ok(await claimForWork(tx, queued.id));
      assert.equal(await claimForWork(tx, queued.id), null);
      assert.equal(
        (await tx.one<{ status: string }>('select status from ai_jobs where id=$1', [queued.id]))
          .status,
        'uncertain',
      );
      checks++;
      await tx.execute("update ai_jobs set status='succeeded' where id=$1", [queued.id]);
      assert.equal(await claimForWork(tx, queued.id), null);
      checks++;
      await actor(tx, outsider);
      await tx.execute('set local role authenticated');
      await denied(tx, () =>
        tx.execute("insert into user_roles(user_id,role) values($1,'system_admin')", [outsider]),
      );
      await tx.execute('reset role');
      await tx.execute('set constraints all immediate');
      throw new Error('ROLLBACK_VERIFIED_FIXTURES');
    })
    .catch((error) => {
      if ((error as Error).message !== 'ROLLBACK_VERIFIED_FIXTURES') throw error;
    });
  const setup = await db.run(null, async (tx) => {
    const client = await tx.one<{ id: string }>(
      "select id from profiles where user_name='demo_client'",
    );
    const manager = await tx.one<{ id: string }>(
      "select id from profiles where user_name='demo_minh'",
    );
    const photographer = await tx.one<{ id: string }>(
      "select p.id from photographers p join profiles u on u.id=p.user_id where u.user_name='demo_linh'",
    );
    const service = await tx.one<{ id: string; studioId: string }>(
      "select s.id,s.studio_id from services s join studios t on t.id=s.studio_id where t.name='Still Studio' and s.is_active limit 1",
    );
    await actor(tx, client.id);
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const p = (await createProject(tx, client.id, {
        title: 'Concurrent verification fixture',
        idea: 'Temporary local verification',
      })) as { id: string };
      const b = await createBooking(tx, client.id, {
        projectId: p.id,
        serviceId: service.id,
        scheduledStart: '2099-10-10T03:00:00.000Z',
        scheduledEnd: '2099-10-10T05:00:00.000Z',
        addOnIds: [],
        note: '',
      });
      ids.push({ projectId: p.id, bookingId: b.id });
    }
    return { ids, managerId: manager.id, photographerId: photographer.id };
  });
  try {
    const outcomes = await Promise.allSettled(
      setup.ids.map((f) =>
        db.run(setup.managerId, (tx) =>
          transition(tx, f.bookingId, {
            to: 'confirmed',
            version: 1,
            reason: '',
            assignedPhotographerId: setup.photographerId,
            resourceIds: [],
          }),
        ),
      ),
    );
    assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((o) => o.status === 'rejected');
    assert.ok(
      rejected?.status === 'rejected' && (rejected.reason as { code: string }).code === '23P01',
    );
    checks++;
  } finally {
    // Delete only the exact synthetic records created immediately above.
    await db.run(null, async (tx) => {
      const bookings = setup.ids.map((f) => f.bookingId);
      await tx.execute(
        'delete from room_messages where room_id in(select id from shoot_rooms where booking_id=any($1::uuid[]))',
        [bookings],
      );
      await tx.execute('delete from shoot_rooms where booking_id=any($1::uuid[])', [bookings]);
      await tx.execute('delete from galleries where booking_id=any($1::uuid[])', [bookings]);
      await tx.execute('delete from schedule_entries where booking_id=any($1::uuid[])', [bookings]);
      await tx.execute('delete from booking_resources where booking_id=any($1::uuid[])', [
        bookings,
      ]);
      await tx.execute('delete from bookings where id=any($1::uuid[])', [bookings]);
      await tx.execute('delete from creative_projects where id=any($1::uuid[])', [
        setup.ids.map((f) => f.projectId),
      ]);
    });
  }
  process.stdout.write(
    `Passed ${checks} database workflow, RLS, role, conflict, stale-action and budget checks; fixtures rolled back.\n`,
  );
} finally {
  await db.close();
}
