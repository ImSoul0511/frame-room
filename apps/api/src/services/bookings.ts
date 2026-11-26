import { z } from 'zod';
import {
  bookingInputSchema,
  completionHoldInputSchema,
  scheduleInputSchema,
  transitionInputSchema,
  briefContentSchema,
  initialBookingInputSchema,
  assignmentInputSchema,
  quoteInputSchema,
  type Booking,
  type BookingCompletion,
  type CreativeProject,
  type Service,
} from '@frameroom/shared';
import type { Transaction } from '../repositories/database.js';
import { booking, manageProvider, project } from './access.js';
import { requireCondition } from '../lib/errors.js';
import { proofingTerms } from './collaboration.js';

export async function createBooking(
  tx: Transaction,
  userId: string,
  input: Omit<z.infer<typeof bookingInputSchema>, 'serviceId'> & { serviceId?: string },
) {
  const p = await project(tx, input.projectId, true);
  requireCondition(p.ownerId === userId);
  requireCondition(!p.bookingId, 409, 'project_already_booked');
  if (input.quoteId)
    await tx.one(
      'select c.id from conversations c join conversation_quotes q on q.conversation_id=c.id where q.id=$1 and c.client_id=$2 for update of c',
      [input.quoteId, userId],
    );
  const quote = input.quoteId
    ? await tx.one<{
        conversationId: string;
        photographerId: string | null;
        studioId: string | null;
        terms: unknown;
      }>(
        `select q.conversation_id,c.photographer_id,c.studio_id,q.terms
       from conversation_quotes q join conversations c on c.id=q.conversation_id
       where q.id=$1 and c.client_id=$2
         and private.provider_visible(c.photographer_id,c.studio_id)
         and q.version=(select max(version) from conversation_quotes where conversation_id=c.id)
       `,
        [input.quoteId, userId],
      )
    : undefined;
  const terms = quote ? quoteInputSchema.parse(quote.terms) : undefined;
  const s =
    quote && terms
      ? {
          ...terms,
          id: null,
          photographerId: quote.photographerId,
          studioId: quote.studioId,
          ownerType: quote.studioId ? 'studio' : 'photographer',
        }
      : await tx.one<Service>(
          `select s.* from services s where id=$1 and is_active and deleted_at is null and private.provider_visible(photographer_id,studio_id) for share`,
          [input.serviceId],
        );
  const own = await tx.one<{ own: boolean }>('select private.owns_provider($1,$2) as own', [
    s.photographerId,
    s.studioId,
  ]);
  requireCondition(!own.own, 422, 'self_booking');
  const addons = s.id
    ? await tx.rows<{ id: string; name: string; price: number }>(
        'select id,name,price from service_add_ons where id=any($1::uuid[]) and service_id=$2 and is_active and deleted_at is null for share',
        [input.addOnIds, s.id],
      )
    : [];
  requireCondition(addons.length === input.addOnIds.length, 422, 'invalid_add_on');
  const quantity = terms?.quantity ?? input.quantity ?? 1;
  const total = s.price * quantity + addons.reduce((sum, addon) => sum + addon.price, 0);
  requireCondition(total <= 2147483647, 422, 'invalid_input');
  requireCondition(
    Date.parse(input.scheduledEnd) - Date.parse(input.scheduledStart) <= 86400000,
    422,
    'invalid_interval',
  );
  requireCondition(
    s.photoCount * quantity <= 10000 &&
      s.retouchedCount * quantity <= 10000 &&
      (s.selectionQuota ?? 0) * quantity <= 10000,
    422,
    'invalid_input',
  );
  const result = await tx.one<Booking>(
    `insert into bookings(client_id,project_id,service_id,owner_type,photographer_id,studio_id,assigned_photographer_id,scheduled_start,scheduled_end,total_price,service_name,service_snapshot,note,quote_id,quantity)
    values($1,$2,$3,$4,$5,$6,$5,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
    [
      userId,
      p.id,
      s.id,
      s.ownerType,
      s.photographerId,
      s.studioId,
      input.scheduledStart,
      input.scheduledEnd,
      total,
      s.name,
      JSON.stringify({
        ...s,
        addOns: addons,
        unitPhotoCount: s.photoCount,
        unitRetouchedCount: s.retouchedCount,
        unitSelectionQuota: s.selectionQuota ?? Math.min(200, s.retouchedCount),
        photoCount: s.photoCount * quantity,
        retouchedCount: s.retouchedCount * quantity,
        selectionQuota: (s.selectionQuota ?? Math.min(200, s.retouchedCount)) * quantity,
        proofingMode:
          s.proofingMode ?? (s.genre === 'event' || s.genre === 'yearbook' ? 'album' : 'select'),
        revisionLimit: s.revisionLimit ?? 2,
      }),
      input.note,
      input.quoteId ?? null,
      quantity,
    ],
  );
  for (const addon of addons) {
    await tx.execute(
      'insert into booking_add_ons(booking_id,add_on_id,name,quantity,unit_price) values($1,$2,$3,1,$4)',
      [result.id, addon.id, addon.name, addon.price],
    );
  }
  await tx.execute('update creative_projects set version=version+1 where id=$1', [p.id]);
  return result;
}

export async function requestBooking(
  tx: Transaction,
  userId: string,
  input: z.output<typeof initialBookingInputSchema>,
  requestKey: string,
) {
  await tx.execute('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `booking:${userId}:${requestKey}`,
  ]);
  const existing = await tx.optional<Booking>(
    'select * from bookings where client_id=$1 and request_key=$2',
    [userId, requestKey],
  );
  if (existing) return existing;
  if (input.quoteId) {
    await tx.execute('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `quote:${input.quoteId}`,
    ]);
    const accepted = await tx.optional<Booking>(
      'select * from bookings where quote_id=$1 and client_id=$2',
      [input.quoteId, userId],
    );
    if (accepted) return accepted;
  }
  requireCondition(Date.parse(input.scheduledStart) > Date.now(), 422, 'invalid_interval');
  const projectId =
    input.projectId ??
    (
      await tx.one<{ id: string }>(
        'insert into creative_projects(owner_id,title,idea) values($1,$2,$3) returning id',
        [userId, input.brief.title, input.brief.concept],
      )
    ).id;
  const created = await createBooking(tx, userId, { ...input, projectId });
  const agreed = await tx.optional<{ serviceSnapshot: Service }>(
    'select service_snapshot from bookings where id=$1',
    [created.id],
  );
  const scope = agreed?.serviceSnapshot;
  await tx.execute('update bookings set request_key=$2 where id=$1', [created.id, requestKey]);
  await createBrief(tx, created.id, userId, {
    ...input.brief,
    requirements: {
      ...input.brief.requirements,
      quantity: created.quantity ?? input.quantity ?? 1,
      ...(scope && {
        genre: scope.genre,
        photoCount: scope.photoCount,
        retouchedCount: scope.retouchedCount,
        revisionLimit: scope.revisionLimit ?? 2,
        budget: created.totalPrice,
      }),
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
    },
  });
  return created;
}
export async function transition(
  tx: Transaction,
  id: string,
  input: z.infer<typeof transitionInputSchema>,
) {
  return tx.one<Booking>('select * from public.frameroom_transition($1,$2,$3,$4,$5,$6,$7,$8)', [
    id,
    input.to,
    input.version,
    input.reason,
    input.scheduledStart ?? null,
    input.scheduledEnd ?? null,
    input.assignedPhotographerId ?? null,
    input.resourceIds,
  ]);
}
export async function reschedule(
  tx: Transaction,
  id: string,
  input: z.infer<typeof scheduleInputSchema>,
) {
  return tx.one<Booking>('select * from public.frameroom_reschedule($1,$2,$3,$4,$5,$6)', [
    id,
    input.version,
    input.scheduledStart,
    input.scheduledEnd,
    input.assignedPhotographerId ?? null,
    input.resourceIds,
  ]);
}

async function bookingEvent(
  tx: Transaction,
  bookingId: string,
  userId: string,
  event: string,
  details: Record<string, unknown>,
  notification = 'bookingUpdated',
) {
  await tx.execute(
    'insert into private.booking_events(booking_id,actor_id,event,details) values($1,$2,$3,$4)',
    [bookingId, userId, event, JSON.stringify(details)],
  );
  await tx.execute('select private.notify_booking_parties($1,$2,$3)', [
    bookingId,
    notification,
    userId,
  ]);
}

export async function assignPhotographer(
  tx: Transaction,
  id: string,
  actorId: string,
  input: z.output<typeof assignmentInputSchema> & { reason?: string },
) {
  const b = await booking(tx, id, true);
  requireCondition(b.studioId, 422, 'invalid_assignment');
  await manageProvider(tx, null, b.studioId);
  const replacement = Boolean(input.reason);
  requireCondition(b.version === input.version, 409, 'stale_version');
  requireCondition(
    replacement
      ? ['confirmed', 'in_progress'].includes(b.status) && b.assignedPhotographerId
      : b.status === 'pending',
    422,
    'invalid_assignment',
  );
  if (!replacement) {
    const latest = await tx.optional<{
      clientApproved: boolean;
      providerApproved: boolean;
      status: string;
    }>(
      'select client_approved,provider_approved,status from brief_versions where booking_id=$1 order by version desc limit 1',
      [id],
    );
    requireCondition(
      latest?.status === 'open' && latest.clientApproved && latest.providerApproved,
      422,
      'brief_required',
    );
  }
  requireCondition(b.assignedPhotographerId !== input.photographerId, 422, 'invalid_assignment');
  await tx.one('select id from studios where id=$1 and deleted_at is null for update', [
    b.studioId,
  ]);
  await manageProvider(tx, null, b.studioId);
  const eligible = await tx.optional(
    `select p.id from studio_members m join photographers p on p.user_id=m.user_id
     where m.studio_id=$1 and p.id=$2 and not p.is_hidden`,
    [b.studioId, input.photographerId],
  );
  requireCondition(eligible, 422, 'invalid_assignment');
  await tx.execute('delete from booking_team where booking_id=$1 and photographer_id=$2', [
    id,
    b.assignedPhotographerId,
  ]);
  await tx.execute('insert into booking_team values($1,$2) on conflict do nothing', [
    id,
    input.photographerId,
  ]);
  if (replacement) {
    const resources = await tx.rows<{ resourceId: string }>(
      'select resource_id from booking_resources where booking_id=$1',
      [id],
    );
    await tx.execute('select private.reserve_booking($1,$2,$3,$4,$5)', [
      id,
      b.scheduledStart,
      b.scheduledEnd,
      input.photographerId,
      resources.map((resource) => resource.resourceId),
    ]);
  } else {
    const conflict = await tx.optional(
      "select id from schedule_entries where photographer_id=$1 and during && tstzrange($2,$3,'[)') limit 1",
      [input.photographerId, b.scheduledStart, b.scheduledEnd],
    );
    requireCondition(!conflict, 409, 'slot_overlap');
  }
  const updated = await tx.one<Booking>(
    'update bookings set assigned_photographer_id=$2,version=version+1 where id=$1 returning *',
    [id, input.photographerId],
  );
  await bookingEvent(
    tx,
    id,
    actorId,
    replacement ? 'reassigned' : 'assigned',
    {
      previousPhotographerId: b.assignedPhotographerId,
      photographerId: input.photographerId,
      reason: input.reason ?? '',
      validation: 'eligible',
    },
    'assignmentUpdated',
  );
  if (b.assignedPhotographerId)
    await tx.execute(
      `insert into notifications(recipient_id,booking_id,event)
     select user_id,null,'assignmentUpdated' from photographers where id=$1 and user_id<>$2`,
      [b.assignedPhotographerId, actorId],
    );
  return updated;
}

export async function availablePhotographers(tx: Transaction, id: string, attendance = false) {
  const b = await booking(tx, id);
  requireCondition(b.studioId, 422, 'invalid_assignment');
  await manageProvider(tx, null, b.studioId);
  if (attendance)
    return tx.rows(
      `with eligible as (
      select photographer_id as id from booking_team where booking_id=$1
      union select jsonb_array_elements_text(details->'previousPhotographerIds')::uuid
        from private.booking_events where booking_id=$1 and event='reassigned'
      union select (details->>'previousPhotographerId')::uuid
        from private.booking_events where booking_id=$1 and event='reassigned'
    ) select p.id,p.display_name,true as is_available,
      case when exists (select 1 from booking_attendance where booking_id=$1)
        then exists (select 1 from booking_attendance where booking_id=$1 and photographer_id=p.id)
        else exists (select 1 from booking_team where booking_id=$1 and photographer_id=p.id)
      end as is_assigned
    from eligible e join photographers p on p.id=e.id order by p.display_name,p.id`,
      [id],
    );
  return tx.rows(
    `select p.id,p.display_name, not exists (
      select 1 from schedule_entries e where e.photographer_id=p.id and e.booking_id is distinct from $2::uuid
      and e.during && tstzrange($3,$4,'[)')
    ) as is_available, exists (select 1 from booking_team t where t.booking_id=$2 and t.photographer_id=p.id) as is_assigned
    from studio_members m join photographers p on p.user_id=m.user_id
     where m.studio_id=$1 and not p.is_hidden order by p.display_name,p.id`,
    [b.studioId, id, b.scheduledStart, b.scheduledEnd],
  );
}

export async function updateTeam(
  tx: Transaction,
  id: string,
  actorId: string,
  input: { photographerIds: string[]; version: number; reason: string },
) {
  const b = await booking(tx, id, true);
  requireCondition(
    b.studioId && ['pending', 'confirmed', 'in_progress'].includes(b.status),
    422,
    'invalid_assignment',
  );
  await tx.one('select id from studios where id=$1 and deleted_at is null for update', [
    b.studioId,
  ]);
  await manageProvider(tx, null, b.studioId);
  requireCondition(b.version === input.version, 409, 'stale_version');
  const pending = b.status === 'pending';
  requireCondition(pending || input.reason, 422, 'reason_required');
  const candidates = (await availablePhotographers(tx, id)) as {
    id: string;
    isAvailable: boolean;
    isAssigned: boolean;
  }[];
  const eligible = input.photographerIds.every((id) =>
    candidates.some((person) => person.id === id),
  );
  requireCondition(eligible, 422, 'invalid_assignment');
  requireCondition(
    input.photographerIds.every((id) =>
      candidates.some((person) => person.id === id && person.isAvailable),
    ),
    409,
    'slot_overlap',
  );
  if (pending) {
    const latest = await tx.optional<{ ready: boolean }>(
      "select status='open' and client_approved and provider_approved as ready from brief_versions where booking_id=$1 order by version desc limit 1",
      [id],
    );
    requireCondition(latest?.ready, 422, 'brief_required');
  }
  await tx.execute('delete from booking_team where booking_id=$1', [id]);
  await tx.execute('insert into booking_team select $1,person from unnest($2::uuid[]) person', [
    id,
    input.photographerIds,
  ]);
  const primary = input.photographerIds[0];
  if (!pending) {
    const resources = await tx.rows<{ resourceId: string }>(
      'select resource_id from booking_resources where booking_id=$1',
      [id],
    );
    await tx.execute('select private.reserve_booking($1,$2,$3,$4,$5)', [
      id,
      b.scheduledStart,
      b.scheduledEnd,
      primary,
      resources.map((item) => item.resourceId),
    ]);
  }
  const result = await tx.one<Booking>(
    'update bookings set assigned_photographer_id=$2,version=version+1 where id=$1 returning *',
    [id, primary],
  );
  await bookingEvent(
    tx,
    id,
    actorId,
    pending ? 'assigned' : 'reassigned',
    {
      previousPhotographerIds: candidates
        .filter((person) => person.isAssigned)
        .map((person) => person.id),
      photographerIds: input.photographerIds,
      reason: input.reason,
    },
    'assignmentUpdated',
  );
  return result;
}

export async function recordAttendance(
  tx: Transaction,
  id: string,
  actorId: string,
  ids: string[],
) {
  const b = await booking(tx, id, true);
  requireCondition(
    b.studioId && ['in_progress', 'proofing'].includes(b.status),
    422,
    'invalid_assignment',
  );
  await manageProvider(tx, null, b.studioId);
  const eligible = await tx.rows<{ id: string }>(
    `select photographer_id as id from booking_team where booking_id=$1
    union select jsonb_array_elements_text(details->'previousPhotographerIds')::uuid
      from private.booking_events where booking_id=$1 and event='reassigned'
    union select (details->>'previousPhotographerId')::uuid
      from private.booking_events where booking_id=$1 and event='reassigned'`,
    [id],
  );
  requireCondition(
    ids.every((person) => eligible.some((record) => record.id === person)),
    422,
    'invalid_assignment',
  );
  await tx.execute('delete from booking_attendance where booking_id=$1', [id]);
  await tx.execute(
    'insert into booking_attendance select $1,person from unnest($2::uuid[]) person',
    [id, ids],
  );
  await bookingEvent(tx, id, actorId, 'attendance_recorded', { photographerIds: ids });
  return { photographerIds: ids };
}

export async function closeBrief(
  tx: Transaction,
  id: string,
  briefId: string,
  actorId: string,
  reason: string,
) {
  const b = await booking(tx, id, true);
  requireCondition(['pending', 'confirmed', 'in_progress'].includes(b.status), 422, 'brief_locked');
  if (b.status === 'pending') await manageProvider(tx, b.photographerId, b.studioId);
  const latest = await tx.one<{
    id: string;
    version: number;
    clientApproved: boolean;
    providerApproved: boolean;
    status: string;
  }>('select * from brief_versions where booking_id=$1 order by version desc limit 1', [id]);
  requireCondition(
    latest.id === briefId && latest.status === 'open' && latest.version !== b.agreedBriefVersion,
    409,
    'stale_brief',
  );
  requireCondition(
    (b.status === 'pending' && b.clientId !== actorId) ||
      !(b.clientId === actorId ? latest.clientApproved : latest.providerApproved),
    403,
    'counterparty_required',
  );
  const result = await tx.one("update brief_versions set status='closed' where id=$1 returning *", [
    briefId,
  ]);
  await bookingEvent(tx, id, actorId, 'brief_revision_requested', { briefId, reason });
  return result;
}

const cancellableStates = ['confirmed', 'in_progress', 'proofing'];
export async function proposeCancellation(
  tx: Transaction,
  id: string,
  actorId: string,
  reason: string,
) {
  const b = await booking(tx, id, true);
  requireCondition(cancellableStates.includes(b.status), 422, 'invalid_transition');
  if (b.clientId !== actorId) await manageProvider(tx, b.photographerId, b.studioId);
  const proposal = await tx.one(
    'insert into booking_cancellations(booking_id,proposed_by,is_client_proposal,reason) values($1,$2,$3,$4) returning *',
    [id, actorId, b.clientId === actorId, reason],
  );
  await bookingEvent(tx, id, actorId, 'cancellation_proposed', { reason });
  return proposal;
}

export async function decideCancellation(
  tx: Transaction,
  id: string,
  actorId: string,
  accept: boolean,
) {
  const b = await booking(tx, id, true);
  requireCondition(cancellableStates.includes(b.status), 422, 'invalid_transition');
  if (b.clientId !== actorId) await manageProvider(tx, b.photographerId, b.studioId);
  const proposal = await tx.one<{ id: string; isClientProposal: boolean; reason: string }>(
    "select * from booking_cancellations where booking_id=$1 and status='proposed' for update",
    [id],
  );
  requireCondition(
    proposal.isClientProposal !== (b.clientId === actorId),
    403,
    'counterparty_required',
  );
  const result = await tx.one(
    'update booking_cancellations set status=$2,decided_by=$3,decided_at=now() where id=$1 returning *',
    [proposal.id, accept ? 'accepted' : 'declined', actorId],
  );
  if (accept) {
    await tx.execute('delete from schedule_entries where booking_id=$1', [id]);
    await tx.execute("update shoot_rooms set status='closed' where booking_id=$1", [id]);
    await tx.execute("update bookings set status='cancelled',version=version+1 where id=$1", [id]);
  }
  await bookingEvent(tx, id, actorId, accept ? 'cancellation_accepted' : 'cancellation_declined', {
    proposalId: proposal.id,
    reason: proposal.reason,
  });
  return result;
}

const completionColumns =
  'id, service_name, version, completion_due_at, completion_hold_at, completion_remaining_ms';

export async function listCompletions(tx: Transaction, page: number) {
  const rows = await tx.rows<BookingCompletion>(
    `select ${completionColumns} from bookings where status='delivered'
     and (completion_due_at is not null or completion_hold_at is not null)
     order by id desc limit 51 offset $1`,
    [(page - 1) * 50],
  );
  return { items: rows.slice(0, 50), hasNext: rows.length > 50 };
}

export async function setCompletionHold(
  tx: Transaction,
  id: string,
  input: z.infer<typeof completionHoldInputSchema>,
) {
  return tx.one<BookingCompletion>(
    `select ${completionColumns} from public.frameroom_set_completion_hold($1,$2,$3,$4)`,
    [id, input.hold, input.version, input.reason],
  );
}
const scopedTermsSchema = z.object({
  price: z.number().int().nonnegative(),
  unitPhotoCount: z.number().int().nonnegative(),
  unitRetouchedCount: z.number().int().nonnegative(),
  unitSelectionQuota: z.number().int().nonnegative(),
  addOns: z.array(z.object({ price: z.number().int().nonnegative() })).default([]),
});

function quantityTerms(b: Booking & { serviceSnapshot?: unknown }, quantity: number) {
  const parsed = scopedTermsSchema.safeParse(b.serviceSnapshot);
  if (!parsed.success) return;
  const units = parsed.data;
  const budget = units.price * quantity + units.addOns.reduce((sum, addon) => sum + addon.price, 0);
  const photoCount = units.unitPhotoCount * quantity;
  const retouchedCount = units.unitRetouchedCount * quantity;
  const selectionQuota = units.unitSelectionQuota * quantity;
  requireCondition(
    budget <= 2147483647 && photoCount <= 10000 && selectionQuota <= 10000,
    422,
    'invalid_input',
  );
  return { budget, photoCount, retouchedCount, selectionQuota };
}

export async function createBrief(
  tx: Transaction,
  id: string,
  userId: string,
  content: z.infer<typeof briefContentSchema>,
) {
  const b = await booking(tx, id, true);
  requireCondition(['pending', 'confirmed', 'in_progress'].includes(b.status), 422, 'brief_locked');
  if (b.status === 'pending' && b.clientId !== userId)
    await manageProvider(tx, b.photographerId, b.studioId);
  if (content.requirements) {
    const quantity = content.requirements.quantity ?? b.quantity ?? 1;
    const terms = quantityTerms(b, quantity);
    if (terms)
      content = {
        ...content,
        requirements: {
          ...content.requirements,
          quantity,
          budget: terms.budget,
          photoCount: terms.photoCount,
          retouchedCount: terms.retouchedCount,
          revisionLimit: proofingTerms(b).revisions,
        },
      };
  }
  const start = content.requirements?.scheduledStart;
  const end = content.requirements?.scheduledEnd;
  const delivery = content.requirements?.deliveryDueAt;
  const highlights = content.requirements?.highlightsDueAt;
  const shootEnd = Date.parse(end ?? b.scheduledEnd);
  requireCondition(!delivery || Date.parse(delivery) >= shootEnd, 422, 'invalid_interval');
  requireCondition(
    !highlights ||
      (Date.parse(highlights) >= shootEnd &&
        (!delivery || Date.parse(highlights) <= Date.parse(delivery))),
    422,
    'invalid_interval',
  );
  if (start || end) {
    requireCondition(
      start &&
        end &&
        Date.parse(end) > Date.parse(start) &&
        Date.parse(end) - Date.parse(start) <= 86400000,
      422,
      'invalid_interval',
    );
    const scheduleChanged =
      Date.parse(start) !== Date.parse(b.scheduledStart) ||
      Date.parse(end) !== Date.parse(b.scheduledEnd);
    if (scheduleChanged) {
      requireCondition(Date.parse(start) > Date.now(), 422, 'invalid_interval');
      if (b.status === 'pending') {
        await tx.execute('delete from booking_team where booking_id=$1', [id]);
        await tx.execute(
          `update bookings set scheduled_start=$2,scheduled_end=$3,version=version+1,
           assigned_photographer_id=case when studio_id is null then assigned_photographer_id else null end
         where id=$1`,
          [id, start, end],
        );
      }
    }
  }
  const created = await tx.one<{ id: string; version: number }>(
    `insert into brief_versions(booking_id,version,content,created_by,client_approved,provider_approved)
    select $1,coalesce(max(version),0)+1,$2,$3,$4,not $4 from brief_versions where booking_id=$1 returning *`,
    [id, JSON.stringify(content), userId, b.clientId === userId],
  );
  await bookingEvent(tx, id, userId, 'brief_submitted', {
    briefId: created.id,
    version: created.version,
  });
  return created;
}
export async function approveBrief(
  tx: Transaction,
  bookingId: string,
  briefId: string,
  userId: string,
) {
  const b = await booking(tx, bookingId, true);
  requireCondition(['pending', 'confirmed', 'in_progress'].includes(b.status), 422, 'brief_locked');
  if (b.status === 'pending' && b.clientId !== userId)
    await manageProvider(tx, b.photographerId, b.studioId);
  const v = await tx.one<{
    version: number;
    content: unknown;
    clientApproved: boolean;
    providerApproved: boolean;
    status: string;
    latestVersion: number;
  }>(
    `select v.*, (select max(version) from brief_versions where booking_id=$2) as latest_version
      from brief_versions v where id=$1 and booking_id=$2 for update`,
    [briefId, bookingId],
  );
  requireCondition(v.version === v.latestVersion && v.status !== 'closed', 409, 'stale_brief');
  if (b.clientId === userId ? v.clientApproved : v.providerApproved) return v;
  const updated = await tx.one<{ clientApproved: boolean; providerApproved: boolean }>(
    `update brief_versions set client_approved=client_approved or $2,provider_approved=provider_approved or not $2 where id=$1 returning *`,
    [briefId, b.clientId === userId],
  );
  const scope = briefContentSchema.safeParse(v.content).data?.requirements;
  if (
    updated.clientApproved &&
    updated.providerApproved &&
    scope?.quantity !== undefined &&
    scope.quantity !== b.quantity
  ) {
    const terms = quantityTerms(b, scope.quantity);
    if (terms)
      await tx.execute(
        `update bookings set quantity=$2,total_price=$3,version=version+1,
        service_snapshot=service_snapshot || jsonb_build_object('photoCount',$4::integer,'retouchedCount',$5::integer,'selectionQuota',$6::integer)
        where id=$1`,
        [
          bookingId,
          scope.quantity,
          terms.budget,
          terms.photoCount,
          terms.retouchedCount,
          terms.selectionQuota,
        ],
      );
  }
  if (b.status !== 'pending' && updated.clientApproved && updated.providerApproved) {
    if (
      scope?.scheduledStart &&
      scope.scheduledEnd &&
      (Date.parse(scope.scheduledStart) !== Date.parse(b.scheduledStart) ||
        Date.parse(scope.scheduledEnd) !== Date.parse(b.scheduledEnd))
    ) {
      requireCondition(Date.parse(scope.scheduledStart) > Date.now(), 422, 'invalid_interval');
      const resources = await tx.rows<{ resourceId: string }>(
        'select resource_id from booking_resources where booking_id=$1',
        [bookingId],
      );
      await tx.execute('select private.reserve_booking($1,$2,$3,$4,$5)', [
        bookingId,
        scope.scheduledStart,
        scope.scheduledEnd,
        b.assignedPhotographerId,
        resources.map((item) => item.resourceId),
      ]);
    }
    await tx.execute('update bookings set agreed_brief_version=$2,version=version+1 where id=$1', [
      bookingId,
      v.version,
    ]);
  }
  await bookingEvent(tx, bookingId, userId, 'brief_approved', { briefId, version: v.version });
  return updated;
}
export async function workspace(tx: Transaction, id: string, userId: string) {
  const b = await booking(tx, id);
  const p = await tx.one<CreativeProject>(
    'select *, $2::uuid as booking_id from creative_projects where id=$1',
    [b.projectId, id],
  );
  const room = await tx.optional<{ id: string; status: string }>(
    'select * from shoot_rooms where booking_id=$1',
    [id],
  );
  const isProvider = await tx.one<{ value: boolean }>('select private.provider_side($1) as value', [
    id,
  ]);
  const canManage = await tx.one<{ value: boolean }>(
    'select private.owns_provider($1,$2) as value',
    [b.photographerId, b.studioId],
  );
  const gallery = await tx.optional<{
    id: string;
    status: string;
    round: number;
    revisionRequestedAt: string | null;
  }>("select * from galleries where booking_id=$1 and (status<>'draft' or $2)", [
    id,
    isProvider.value,
  ]);
  return {
    booking: b,
    project: p,
    room: room ?? null,
    isProvider: isProvider.value,
    canManage: canManage.value,
    isClient: b.clientId === userId,
    briefs: await tx.rows(
      'select * from brief_versions where booking_id=$1 order by version desc',
      [id],
    ),
    cancellation: cancellableStates.includes(b.status)
      ? ((await tx.optional(
          "select * from booking_cancellations where booking_id=$1 and status='proposed'",
          [id],
        )) ?? null)
      : null,
    messages:
      room && ['confirmed', 'in_progress'].includes(b.status)
        ? await tx.rows(
            'select * from (select * from room_messages where room_id=$1 and not is_hidden order by created_at desc,id desc limit 100) m order by created_at,id',
            [room.id],
          )
        : [],
    decisions:
      room && ['confirmed', 'in_progress'].includes(b.status)
        ? await tx.rows('select * from room_decisions where room_id=$1 order by created_at', [
            room.id,
          ])
        : [],
    milestones:
      room && ['confirmed', 'in_progress'].includes(b.status)
        ? await tx.rows(
            'select * from room_milestones where room_id=$1 order by due_at nulls last,created_at',
            [room.id],
          )
        : [],
    gallery: gallery ?? null,
    proofing: proofingTerms(b),
    roundNotes: gallery
      ? await tx.rows(
          'select round,note from gallery_round_notes where gallery_id=$1 order by round',
          [gallery.id],
        )
      : [],
    photoFeedback:
      gallery && gallery.status !== 'draft'
        ? await tx.rows(
            `select f.* from photo_feedback f join gallery_images i on i.id=f.image_id
           where i.gallery_id=$1 and ($2 or f.author_id=$3 or f.round<$4 or $5<>'open_for_selection')
           order by f.round,f.created_at,f.id`,
            [gallery.id, !isProvider.value, userId, gallery.round, gallery.status],
          )
        : [],
    images: gallery
      ? await tx.rows(
          'select * from gallery_images where gallery_id=$1 order by proof_round desc,created_at,id',
          [gallery.id],
        )
      : [],
    selections: gallery
      ? await tx.rows('select * from gallery_selections where gallery_id=$1 and round=$2', [
          gallery.id,
          gallery.round,
        ])
      : [],
    deliveries:
      isProvider.value || ['delivered', 'completed'].includes(b.status)
        ? await tx.rows(
            'select * from deliveries where booking_id=$1 and (selection_round=$2 or selection_round is null)',
            [id, gallery?.round ?? null],
          )
        : [],
    resources: await tx.rows('select * from booking_resources where booking_id=$1', [id]),
    review:
      (await tx.optional(
        `select id, rating, comment, is_hidden, deleted_at, moderation_reason, reassessment_requested_at
         from reviews where booking_id=$1 and (author_id=$2 or (not is_hidden and deleted_at is null))`,
        [id, userId],
      )) ?? null,
  };
}
