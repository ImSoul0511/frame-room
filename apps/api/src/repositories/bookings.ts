import type { Transaction } from './database.js';
import type {
  Booking,
  BookingWorkspace,
  BriefContent,
  BriefVersion,
  ScheduleInput,
  TransitionInput,
  WorkspaceDelivery,
  WorkspaceGallery,
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

// --- Slice 105d: Workspace projection read queries ---

/** Fetches the project linked to a booking. */
export async function findBookingProject(
  tx: Transaction,
  projectId: string,
): Promise<BookingWorkspace['project']> {
  const row = await tx.one<BookingWorkspace['project']>(
    `select id, owner_id, title, idea, brief, reference_paths, version, booking_id, created_at, updated_at
     from creative_projects
     where id = $1`,
    [projectId],
  );
  return { ...row, version: Number(row.version) };
}

/** Fetches the provider summary (photographer or studio) for a booking. */
export async function findBookingProvider(
  tx: Transaction,
  booking: Booking,
): Promise<BookingWorkspace['provider']> {
  if (booking.ownerType === 'photographer' && booking.photographerId) {
    return tx.one<BookingWorkspace['provider']>(
      `select 'photographer'::text as owner_type, id, display_name, avatar_path, city
       from photographers
       where id = $1`,
      [booking.photographerId],
    );
  }
  return tx.one<BookingWorkspace['provider']>(
    `select 'studio'::text as owner_type, id, name as display_name, logo_path as avatar_path, city
     from studios
     where id = $1`,
    [booking.studioId],
  );
}

/** Fetches the assigned photographer summary when one is assigned to the booking. */
export async function findAssignedPhotographer(
  tx: Transaction,
  photographerId: string | null,
): Promise<BookingWorkspace['assignedPhotographer']> {
  if (!photographerId) return null;
  const row = await tx.optional<NonNullable<BookingWorkspace['assignedPhotographer']>>(
    `select id, user_id, display_name, avatar_path
     from photographers
     where id = $1`,
    [photographerId],
  );
  return row ?? null;
}

/** Lists studio resources reserved for the booking via schedule_entries. */
export async function listBookingResources(
  tx: Transaction,
  bookingId: string,
): Promise<BookingWorkspace['resources']> {
  return tx.rows<BookingWorkspace['resources'][number]>(
    `select distinct sr.id, sr.studio_id, sr.name, sr.type
     from schedule_entries se
     join studio_resources sr on sr.id = se.resource_id
     where se.booking_id = $1 and se.resource_id is not null
     order by sr.name asc`,
    [bookingId],
  );
}

/** Lists all brief versions for a booking ordered sequentially by version. */
export async function listBriefVersions(
  tx: Transaction,
  bookingId: string,
): Promise<BriefVersion[]> {
  const rows = await tx.rows<BriefVersion>(
    `select id, booking_id, version, content, created_by, client_approved, provider_approved, created_at
     from brief_versions
     where booking_id = $1
     order by version asc`,
    [bookingId],
  );
  return rows.map(coerceBriefVersion);
}

/** Lists room messages for a booking with nullable signed URLs until BE-103 merges. */
export async function listBookingMessages(
  tx: Transaction,
  bookingId: string,
): Promise<BookingWorkspace['messages']> {
  const rows = await tx.rows<{
    id: string;
    bookingId: string;
    senderId: string;
    kind: string;
    body: string;
    attachments: Array<{
      storagePath: string;
      mimeType?: string | null;
      fileName?: string | null;
    }> | null;
    createdAt: string;
  }>(
    `select id, booking_id, sender_id, kind, body, attachments, created_at
     from room_messages
     where booking_id = $1
     order by created_at asc`,
    [bookingId],
  );
  return rows.map((row) => ({
    ...row,
    attachments: (row.attachments ?? []).map((att) => ({
      storagePath: att.storagePath,
      url: null,
      mimeType: att.mimeType ?? null,
      fileName: att.fileName ?? null,
    })),
  }));
}

/** Lists room decisions recorded on a booking. */
export async function listBookingDecisions(
  tx: Transaction,
  bookingId: string,
): Promise<BookingWorkspace['decisions']> {
  return tx.rows<BookingWorkspace['decisions'][number]>(
    `select id, booking_id, title, summary, created_by, created_at
     from room_decisions
     where booking_id = $1
     order by created_at asc`,
    [bookingId],
  );
}

/** Lists room milestones ordered by sort_order then created_at. */
export async function listBookingMilestones(
  tx: Transaction,
  bookingId: string,
): Promise<BookingWorkspace['milestones']> {
  const rows = await tx.rows<BookingWorkspace['milestones'][number]>(
    `select id, booking_id, title, status, due_at, completed_at, sort_order, created_at, updated_at
     from room_milestones
     where booking_id = $1
     order by sort_order asc, created_at asc`,
    [bookingId],
  );
  return rows.map((row) => ({ ...row, sortOrder: Number(row.sortOrder) }));
}

/** Lists visible proofing galleries and their images (draft galleries are provider-only). */
export async function listBookingGalleries(
  tx: Transaction,
  bookingId: string,
  includeDrafts: boolean,
): Promise<WorkspaceGallery[]> {
  const galleries = await tx.rows<Omit<WorkspaceGallery, 'images'>>(
    `select id, booking_id, title, status, created_at, updated_at
     from proofing_galleries
     where booking_id = $1
       and ($2::boolean or status <> 'draft')
     order by created_at asc`,
    [bookingId, includeDrafts],
  );
  if (galleries.length === 0) return [];

  const galleryIds = galleries.map((g) => g.id);
  const images = await tx.rows<WorkspaceGallery['images'][number]>(
    `select id, gallery_id, storage_path, null::text as url, caption, selected, sort_order, created_at
     from proofing_images
     where gallery_id = any($1::uuid[])
     order by sort_order asc, created_at asc`,
    [galleryIds],
  );

  const byGallery = new Map<string, WorkspaceGallery['images']>();
  for (const img of images) {
    const list = byGallery.get(img.galleryId) ?? [];
    list.push({ ...img, sortOrder: Number(img.sortOrder) });
    byGallery.set(img.galleryId, list);
  }

  return galleries.map((g) => ({
    ...g,
    images: byGallery.get(g.id) ?? [],
  }));
}

/** Lists final delivery files for a booking with nullable signed URLs until BE-103 merges. */
export async function listBookingDeliveries(
  tx: Transaction,
  bookingId: string,
): Promise<WorkspaceDelivery[]> {
  const rows = await tx.rows<WorkspaceDelivery>(
    `select id, booking_id, storage_path, null::text as url, file_name, mime_type, size_bytes, note, uploaded_by, created_at
     from deliveries
     where booking_id = $1
     order by created_at asc`,
    [bookingId],
  );
  return rows.map((row) => ({
    ...row,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
  }));
}

/** Fetches the single booking review if one has been submitted. */
export async function findBookingReview(
  tx: Transaction,
  bookingId: string,
): Promise<BookingWorkspace['review']> {
  const row = await tx.optional<NonNullable<BookingWorkspace['review']>>(
    `select id, booking_id, reviewer_id, rating, comment, created_at
     from reviews
     where booking_id = $1`,
    [bookingId],
  );
  return row ? { ...row, rating: Number(row.rating) } : null;
}
