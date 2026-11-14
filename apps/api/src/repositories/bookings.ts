import type { Transaction } from './database.js';
import type {
  Booking,
  BriefContent,
  BriefVersion,
  ScheduleInput,
  TransitionInput,
} from '../schemas/bookings.js';

export interface BookableServiceRow {
  id: string;
  ownerType: 'photographer' | 'studio';
  photographerId: string | null;
  studioId: string | null;
  name: string;
  description: string;
  genre: string;
  durationMinutes: number;
  price: number;
  photoCount: number;
  retouchedCount: number;
}

export interface BookableAddOnRow {
  id: string;
  name: string;
  price: number;
}

export interface CreateBookingRecord {
  clientId: string;
  projectId: string;
  serviceId: string;
  ownerType: 'photographer' | 'studio';
  photographerId: string | null;
  studioId: string | null;
  assignedPhotographerId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  totalPrice: number;
  serviceName: string;
  serviceSnapshot: Record<string, unknown>;
  note: string;
}

function coerceBooking(row: Booking): Booking {
  return {
    ...row,
    totalPrice: Number(row.totalPrice),
    version: Number(row.version),
    agreedBriefVersion: row.agreedBriefVersion === null ? null : Number(row.agreedBriefVersion),
  };
}

/** Finds an active, non-deleted service whose provider is publicly visible, locking for share. */
export async function findBookableService(
  tx: Transaction,
  serviceId: string,
): Promise<BookableServiceRow | undefined> {
  const row = await tx.optional<BookableServiceRow>(
    `select s.id, s.owner_type, s.photographer_id, s.studio_id,
            s.name, s.description, s.genre, s.duration_minutes, s.price,
            s.photo_count, s.retouched_count
     from services s
     where s.id = $1
       and s.is_active = true
       and s.deleted_at is null
       and private.provider_visible(s.photographer_id, s.studio_id)
     for share`,
    [serviceId],
  );
  if (!row) return undefined;
  return {
    ...row,
    durationMinutes: Number(row.durationMinutes),
    price: Number(row.price),
    photoCount: Number(row.photoCount),
    retouchedCount: Number(row.retouchedCount),
  };
}

/** Checks via DB helper whether the current actor owns or manages the provider. */
export async function isSelfProvider(
  tx: Transaction,
  photographerId: string | null,
  studioId: string | null,
): Promise<boolean> {
  const row = await tx.one<{ own: boolean }>('select private.owns_provider($1, $2) as own', [
    photographerId,
    studioId,
  ]);
  return row.own;
}

/** Loads active, non-deleted add-ons belonging to the target service, locking for share. */
export async function findActiveServiceAddOns(
  tx: Transaction,
  serviceId: string,
  addOnIds: string[],
): Promise<BookableAddOnRow[]> {
  if (addOnIds.length === 0) return [];
  const rows = await tx.rows<BookableAddOnRow>(
    `select id, name, price
     from service_add_ons
     where id = any($1::uuid[])
       and service_id = $2
       and is_active = true
       and deleted_at is null
     for share`,
    [addOnIds, serviceId],
  );
  return rows.map((row) => ({ ...row, price: Number(row.price) }));
}

/** Inserts a pending booking row and returns the coerced booking record. */
export async function insertBooking(
  tx: Transaction,
  record: CreateBookingRecord,
): Promise<Booking> {
  const row = await tx.one<Booking>(
    `insert into bookings (
       client_id, project_id, service_id, owner_type, photographer_id, studio_id,
       assigned_photographer_id, scheduled_start, scheduled_end, total_price,
       service_name, service_snapshot, note
     )
     values ($1, $2, $3, $4::public.provider_type, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
     returning id, client_id, project_id, service_id, owner_type, photographer_id, studio_id,
               assigned_photographer_id, status, scheduled_start, scheduled_end, total_price,
               service_name, version, agreed_brief_version, created_at, updated_at`,
    [
      record.clientId,
      record.projectId,
      record.serviceId,
      record.ownerType,
      record.photographerId,
      record.studioId,
      record.assignedPhotographerId,
      record.scheduledStart,
      record.scheduledEnd,
      record.totalPrice,
      record.serviceName,
      JSON.stringify(record.serviceSnapshot),
      record.note,
    ],
  );
  return coerceBooking(row);
}

/** Bumps creative_projects.version after attaching a booking. */
export async function incrementProjectVersion(tx: Transaction, projectId: string): Promise<void> {
  await tx.execute('update creative_projects set version = version + 1 where id = $1', [projectId]);
}

/** Lists up to 100 bookings readable by the current actor, newest scheduled first. */
export async function listReadableBookings(tx: Transaction): Promise<Booking[]> {
  const rows = await tx.rows<Booking>(
    `select id, client_id, project_id, service_id, owner_type, photographer_id, studio_id,
            assigned_photographer_id, status, scheduled_start, scheduled_end, total_price,
            service_name, version, agreed_brief_version, created_at, updated_at
     from bookings
     where private.can_read_booking(id)
     order by scheduled_start desc
     limit 100`,
  );
  return rows.map(coerceBooking);
}

// --- Slice 105b: Positional DB RPC invocations for transitions and rescheduling ---

/** Calls the DB state-machine RPC frameroom_transition using positional arguments. */
export async function callTransitionBooking(
  tx: Transaction,
  bookingId: string,
  input: TransitionInput,
): Promise<Booking> {
  const row = await tx.one<Booking>(
    `select id, client_id, project_id, service_id, owner_type, photographer_id, studio_id,
            assigned_photographer_id, status, scheduled_start, scheduled_end, total_price,
            service_name, version, agreed_brief_version, created_at, updated_at
     from public.frameroom_transition($1, $2::public.booking_status, $3, $4, $5, $6, $7, $8::uuid[])`,
    [
      bookingId,
      input.to,
      input.version,
      input.reason,
      input.scheduledStart ?? null,
      input.scheduledEnd ?? null,
      input.assignedPhotographerId ?? null,
      input.resourceIds,
    ],
  );
  return coerceBooking(row);
}

/** Calls the DB rescheduling RPC frameroom_reschedule using positional arguments. */
export async function callRescheduleBooking(
  tx: Transaction,
  bookingId: string,
  input: ScheduleInput,
): Promise<Booking> {
  const row = await tx.one<Booking>(
    `select id, client_id, project_id, service_id, owner_type, photographer_id, studio_id,
            assigned_photographer_id, status, scheduled_start, scheduled_end, total_price,
            service_name, version, agreed_brief_version, created_at, updated_at
     from public.frameroom_reschedule($1, $2, $3, $4, $5, $6::uuid[])`,
    [
      bookingId,
      input.version,
      input.scheduledStart,
      input.scheduledEnd,
      input.assignedPhotographerId ?? null,
      input.resourceIds,
    ],
  );
  return coerceBooking(row);
}

// --- Slice 105c: Brief version persistence and bilateral approval queries ---

function coerceBriefVersion(row: BriefVersion): BriefVersion {
  return { ...row, version: Number(row.version) };
}

/** Inserts a new sequential brief version and auto-approves the author's side. */
export async function insertBriefVersion(
  tx: Transaction,
  bookingId: string,
  userId: string,
  content: BriefContent,
  isClient: boolean,
): Promise<BriefVersion> {
  const row = await tx.one<BriefVersion>(
    `insert into brief_versions (booking_id, version, content, created_by, client_approved, provider_approved)
     select $1, coalesce(max(version), 0) + 1, $2::jsonb, $3, $4, not $4
     from brief_versions
     where booking_id = $1
     returning id, booking_id, version, content, created_by, client_approved, provider_approved, created_at`,
    [bookingId, JSON.stringify(content), userId, isClient],
  );
  return coerceBriefVersion(row);
}

/** Locks and fetches a specific brief version belonging to the given booking. */
export async function findBriefVersionForUpdate(
  tx: Transaction,
  bookingId: string,
  briefId: string,
): Promise<BriefVersion | undefined> {
  const row = await tx.optional<BriefVersion>(
    `select id, booking_id, version, content, created_by, client_approved, provider_approved, created_at
     from brief_versions
     where id = $1 and booking_id = $2
     for update`,
    [briefId, bookingId],
  );
  return row ? coerceBriefVersion(row) : undefined;
}

/** Marks the caller's side (client or provider) as approved on a brief version. */
export async function approveBriefSide(
  tx: Transaction,
  briefId: string,
  isClient: boolean,
): Promise<BriefVersion> {
  const row = await tx.one<BriefVersion>(
    `update brief_versions
     set client_approved = client_approved or $2,
         provider_approved = provider_approved or not $2
     where id = $1
     returning id, booking_id, version, content, created_by, client_approved, provider_approved, created_at`,
    [briefId, isClient],
  );
  return coerceBriefVersion(row);
}

/** Updates agreed_brief_version and bumps booking version only when the agreed version changes. */
export async function setAgreedBriefVersion(
  tx: Transaction,
  bookingId: string,
  briefVersion: number,
): Promise<void> {
  await tx.execute(
    `update bookings
     set agreed_brief_version = $2,
         version = version + 1
     where id = $1
       and agreed_brief_version is distinct from $2`,
    [bookingId, briefVersion],
  );
}
