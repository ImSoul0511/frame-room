# FrameRoom: MVP ERD (draft v0, review before implementation)

The [MVP database/access document](mvp.md) and ordered migrations describe MVP-001.
This historical ERD preserves draft questions, not a claim that its complete column
inventory is implemented unchanged. AI project/job/artifact/usage/action tables are
defined by migrations and reflected in generated database types.

**Location:** docs/db/erd_v0.md
**Inputs:** [API contract](../api/contract_v0.md), historical week-one entity list, [contribution rules](../contributing.md#4-database).
**Status:** Reviewed design decisions as of 2026-10-20, not frozen. Section 6 retains open questions. Foundation translates this design; no business tables/migrations are implemented.
**Schema source of truth:** SQL migrations in supabase/migrations/. This file is a design only.

---

## 1. Design principles

- Plural snake_case tables, server-generated UUIDv7 business IDs from a migration-provided function (not gen_random_uuid()), timestamptz created_at/updated_at, <singular_table>_id FKs, PostgreSQL status enums.
- Default id PK except documented composite/FK PKs. Copy profiles.id from auth.users.id unchanged; preserve user FKs and existing PK/FK values. New file-name UUIDs use v7.
- Database enums use snake_case equivalents of contract 3.1 with identical values, e.g. booking_status/genre; existing user_role maps to Role. RegistrationRole, BookingSide, SearchParsedKey, TimelineItemType are API-only.
- API returns URLs; database stores bucket paths and backend generates public/signed URLs under contract 2.6.
- Thumbnail names use {uuid}_thumb.webp; store main path and derive thumbnail.
- Email comes from auth.users, not duplicated in profiles.
- Derive rather than store roles except system_admin, portfolioCount, memberCount, imageCount, selectedCount, currentBriefVersion, shootRoomId, resourceIds from booking_resources, participants. Cached rating_avg/review_count/price_from are trigger-maintained for filtering/sorting.
- Soft-delete portfolios/studios/services/service_add_ons/resources/reviews. Retain deleted portfolio/media 30 days before cleanup. Individually deleted images and child/temporary data follow contract 2.4 hard-deletion rules. Never delete bookings; cancel by state.
- Prevent schedule overlap with tstzrange + btree_gist exclusions and half-open [start,end) intervals.
- Enable deny-by-default RLS. This design lists helpers (4); feature tasks must add their role/action matrix and policies. No implemented matrix is claimed.

---

## 2. Relationship overview

```mermaid
erDiagram
  profiles ||--o{ user_roles : stores_admin_role
  profiles ||--o| photographers : has_profile
  photographers ||--o{ studio_members : member_of
  photographers ||--o{ studios : creates
  studios ||--o{ studio_members : has_members
  studios ||--o{ studio_invitations : invites
  photographers ||--o{ studio_invitations : invited_photographer

  photographers |o--o{ portfolios : owns
  studios |o--o{ portfolios : owns
  portfolios ||--o{ portfolio_images : contains
  portfolio_images ||--o{ image_tags : tagged
  tags ||--o{ image_tags : tag

  photographers |o--o{ services : owns
  studios |o--o{ services : owns
  services ||--o{ service_add_ons : has

  studios ||--o{ resources : has
  resources |o--o{ schedule_entries : reserves
  photographers |o--o{ schedule_entries : busy

  profiles ||--o{ bookings : customer
  photographers |o--o{ bookings : provider
  studios |o--o{ bookings : provider
  photographers |o--o{ bookings : assigned
  services |o--o{ bookings : service_snapshot_source
  bookings ||--o{ booking_add_ons : snapshots
  bookings ||--o{ brief_versions : versions
  bookings ||--o{ booking_status_events : history
  bookings ||--o{ booking_assignment_events : assignment_history
  photographers |o--o{ booking_assignment_events : previous_assignee
  photographers ||--o{ booking_assignment_events : new_assignee
  profiles ||--o{ booking_assignment_events : assigns
  bookings ||--o{ booking_resources : resource_snapshots
  resources ||--o{ booking_resources : snapshot_source
  bookings ||--o{ schedule_entries : reserves

  bookings ||--o| shoot_rooms : opens
  shoot_rooms ||--o{ messages : has
  messages ||--o{ message_attachments : attaches
  shoot_rooms ||--o{ decisions : has
  shoot_rooms ||--o{ milestones : has

  bookings ||--o| galleries : has
  galleries ||--o{ gallery_images : contains
  gallery_images ||--o{ image_notes : notes
  bookings ||--o| deliveries : has
  deliveries ||--o{ delivery_items : contains
  gallery_images |o--o{ delivery_items : preview_source

  bookings ||--o| reviews : receives
  profiles ||--o{ reviews : writes
  photographers |o--o{ reviews : about
  studios |o--o{ reviews : about
  profiles |o--o{ messages : sender
  profiles ||--o{ reports : submits

  profiles {
    uuid id PK,FK "Supabase Auth ID, preserved"
    text user_name UK "NN; lowercase; 3-30 characters"
  }
  photographers {
    uuid id PK "UUIDv7"
    uuid user_id FK,UK "profiles.id; NN"
  }
  studios {
    uuid id PK "UUIDv7"
    uuid created_by FK "photographers.user_id; NN; not unique"
  }
  studio_members {
    uuid id PK "UUIDv7"
    uuid studio_id FK "NN; unique together with user_id"
    uuid user_id FK "photographers.user_id; NN"
    studio_member_role role "manager or photographer"
  }
  bookings {
    uuid id PK "UUIDv7"
    uuid customer_id FK "NN; ON DELETE RESTRICT"
    provider_type provider_type "NN; XOR provider FKs"
    uuid photographer_id FK "RESTRICT; personal provider"
    uuid studio_id FK "RESTRICT; studio provider"
    uuid assigned_photographer_id FK "RESTRICT; required for confirmed studio booking"
    integer service_photo_count "Snapshot; nullable; nonnegative"
    integer service_retouched_count "Snapshot; nullable; nonnegative"
    integer total_price "NN; service snapshot plus add-ons"
    booking_status status "NN"
    timestamptz scheduled_start "Both null or valid interval"
    timestamptz scheduled_end "Both null or valid interval"
    integer agreed_brief_version FK "Same booking; both sides approved"
  }
  booking_resources {
    uuid booking_id PK,FK "RESTRICT; composite PK"
    uuid resource_id PK,FK "RESTRICT; composite PK"
    text resource_name "NN; snapshot"
    resource_type resource_type "NN; snapshot"
  }
  booking_assignment_events {
    uuid id PK "UUIDv7; append-only"
    uuid booking_id FK "NN; RESTRICT"
    uuid from_photographer_id FK "Nullable; RESTRICT"
    uuid to_photographer_id FK "NN; RESTRICT"
    uuid actor_id FK "NN; manager; RESTRICT"
    timestamptz created_at "NN; no updated_at"
  }

  portfolio_images {
    integer width "NN; 1-1280"
    integer height "NN; 1-1280"
  }
  gallery_images {
    integer width "NN; 1-1280"
    integer height "NN; 1-1280"
  }
  reviews {
    uuid booking_id FK,UK "NN; unconditional unique including soft-deleted rows"
  }
```

---

## 3. Table details

Notation: PK, FK, UQ, NN (not null). Tables have created_at/updated_at unless explicitly documented with only created_at or granted_at.

### 3.1 Accounts

**profiles** (same id as auth.users.id)

| Column       | Type                                       | Notes                                                                                          |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| id           | uuid PK, FK `auth.users` on delete cascade |                                                                                                |
| user_name    | text UQ NN                                 | 3–30 characters; CHECK `^[a-z0-9][a-z0-9_]{2,29}$`; trim/lowercase before write; /u/{userName} |
| display_name | text NN                                    | check 1–60 characters                                                                          |
| avatar_path  | text                                       | bucket `avatars`                                                                               |

**`user_roles`**: PK `(user_id, role)`

| Column     | Type               | Notes                                              |
| ---------- | ------------------ | -------------------------------------------------- |
| user_id    | uuid FK `profiles` |                                                    |
| role       | enum user_role     | Store system_admin only; CHECK role='system_admin' |
| granted_at | timestamptz        |                                                    |

Public registration allows client/photographer (RegistrationRole, not a stored registration-role column). All profiles have client capability. Store only manually provisioned system_admin in user_roles. Derive photographer from photographers and studio_manager from manager membership in non-deleted studios. No separate studio account, manager signup, or client metadata admin grant. Photographer profile precedes studio creation. Losing the last manager membership removes studio_manager without removing photographer.

Normalized user_name is globally unique, distinct from display_name; API uses userName. Invalid format: 400; unique violation: 409 user_name_taken. Require a valid username before onboarding completes, enforce atomically. Renaming invalidates old URLs; no aliases/redirects.

### 3.2 Photographers and studios

**`photographers`**

| Column                        | Type                              | Notes                                                                  |
| ----------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| user_id                       | uuid UQ NN FK profiles            | Profile owner                                                          |
| display_name                  | text NN                           | 1–60                                                                   |
| bio                           | text                              | ≤ 1000                                                                 |
| genres                        | genre[] NN                        | 1–5 items                                                              |
| styles                        | text[]                            | <=10 items, each <=30 characters; taxonomy **[?]** #2                  |
| professional_roles            | professional_role[] NN default {} | Display specialties retoucher/art_director; no authorization/workflow  |
| city, district                | text                              |                                                                        |
| price_from                    | integer                           | Trigger-maintained minimum active-service price; null if none          |
| avatar_path, cover_image_path | text                              | avatars and proposed profile-covers buckets                            |
| rating_avg                    | numeric(2,1)                      | Null without reviews; trigger-maintained                               |
| review_count                  | integer NN default 0              | Trigger-maintained                                                     |
| is_hidden                     | boolean NN default false          | Admin moderation; exclude public lists/Explore/search and new bookings |

Index: `(city, district)`, GIN `genres`, GIN `styles`.

**`studios`**

| Column                        | Type                                                 | Notes                                                                    |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| name                          | text NN                                              | 1–80                                                                     |
| description                   | text                                                 | ≤ 2000                                                                   |
| avatar_path, cover_image_path | text                                                 | avatars/profile-covers buckets                                           |
| genres                        | `genre[]` NN                                         | 1–5                                                                      |
| city, district, address       | text                                                 | address ≤ 200                                                            |
| price_from                    | integer                                              | Trigger-maintained minimum active-service price; null if none            |
| rating_avg, review_count      | same as photographers                                |                                                                          |
| is_hidden                     | boolean NN default false                             | Admin moderation; exclude public lists/Explore/search and new bookings   |
| created_by                    | uuid NN FK photographers(user_id) ON DELETE RESTRICT | Immutable founder user, not unique; current authority follows membership |
| deleted_at                    | timestamptz                                          | Soft delete                                                              |

**`studio_members`**

| Column    | Type                                                 | Notes                                                      |
| --------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| studio_id | uuid NN FK `studios`                                 |                                                            |
| user_id   | uuid NN FK photographers(user_id) ON DELETE RESTRICT | All members including managers need a photographer profile |
| role      | enum studio_member_role                              | manager/photographer; not display specialties              |
| joined_at | timestamptz                                          |                                                            |

UQ(studio_id,user_id), not user_id or studios.created_by individually. A photographer can create/join multiple studios with different roles. Derive photographer_id through unique photographers.user_id instead of duplicating. FKs require profiles and prevent deleting referenced photographers.

Create studio and first manager (user_id=created_by) atomically using token identity. A deferred constraint trigger requires at least one manager for every non-deleted studio; lock studio on membership changes to prevent concurrent last-manager departures (422). Hard-delete departed memberships. created_by is audit-only after departure; authority derives from current membership. Display specialties remain in professional_roles.

**`studio_invitations`**

| Column          | Type                     | Notes                                        |
| --------------- | ------------------------ | -------------------------------------------- |
| studio_id       | uuid NN FK               |                                              |
| photographer_id | uuid NN FK photographers | Invitee                                      |
| role            | `studio_member_role`     | default `photographer`                       |
| status          | enum `invitation_status` | `pending`, `accepted`, `declined`, `revoked` |
| invited_by      | uuid FK `profiles`       |                                              |
| responded_at    | timestamptz              |                                              |

Partial unique: `(studio_id, photographer_id) WHERE status = 'pending'` (409 `already_exists`).

### 3.3 Services

**`services`**

| Column                       | Type                    | Notes     |
| ---------------------------- | ----------------------- | --------- |
| owner_type                   | enum `provider_type` NN |           |
| photographer_id              | uuid FK                 |           |
| studio_id                    | uuid FK                 |           |
| name                         | text NN                 | 1–100     |
| description                  | text                    | ≤ 1000    |
| genre                        | `genre` NN              |           |
| duration_minutes             | integer NN              | > 0       |
| price                        | integer NN              | ≥ 0 (VND) |
| photo_count, retouched_count | integer                 |           |
| is_active                    | boolean NN default true |           |
| deleted_at                   | timestamptz             |           |

XOR: photographer owner requires photographer_id and null studio_id; studio owner requires studio_id and null photographer_id.

**`service_add_ons`**: `service_id` FK NN, `name` NN (1–100), `description` (≤ 500), `price` ≥ 0, `is_active`, `deleted_at`.

### 3.4 Portfolios and tags

**`portfolios`**

| Column          | Type                                        | Notes                                                                             |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| owner_type      | enum provider_type NN                       | photographer or studio                                                            |
| photographer_id | uuid FK                                     | Present when `owner_type = photographer`                                          |
| studio_id       | uuid FK                                     | Present when `owner_type = studio`                                                |
| title           | text NN                                     | 1–120                                                                             |
| genre           | `genre` NN                                  |                                                                                   |
| description     | text                                        | ≤ 2000                                                                            |
| status          | enum portfolio_status NN default draft      | hidden is admin-only and distinct from deleted_at                                 |
| cover_image_id  | uuid FK portfolio_images ON DELETE SET NULL | Deferrable; null falls back to lowest sort_order; backend verifies same portfolio |
| published_at    | timestamptz                                 | Set on publish, clear on draft, refresh on republish                              |
| deleted_at      | timestamptz                                 | Cleanup portfolio/images/files after 30 days                                      |

XOR owner FKs as services. Photographers own through photographer profiles; studios own via studio_id and current managers administer.

Indexes: (status,published_at desc), photographer_id, studio_id. Public queries always exclude deleted_at IS NOT NULL.

**`portfolio_images`**

| Column                             | Type                                    | Notes                                                                       |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| portfolio_id                       | uuid NN FK                              |                                                                             |
| storage_path                       | text NN                                 | portfolio-images main path; derive thumbnail with _thumb suffix             |
| width, height                      | integer NN                              | Each >0 and <=1280; backend verifies actual Storage metadata                |
| caption                            | text                                    | ≤ 300                                                                       |
| provenance                         | enum `provenance` NN default `captured` |                                                                             |
| sort_order                         | integer NN                              | Starts at 0                                                                 |
| is_hidden                          | boolean NN default false                | Admin-hidden in API (contract 17); cannot revoke direct public Storage URLs |
| source, collected_at, license_note | text, timestamptz, text                 | Demo provenance; null for photographer uploads                              |

**tags**: slug UQ NN, name NN, kind tag_kind NN (tone/setting/mood). Detailed taxonomy awaits decision #2. Extend DB/API enum groups together.

**image_tags**: composite PK(portfolio_image_id,tag_id), source tag_source NN (manual/ai), nullable confidence numeric(3,2). Annotation ownership remains partially open in question #2.

**image_embeddings** (deferred; no migration yet): portfolio_image_id PK FK, model text, embedding vector(<dim>), created_at. Dimensions await model choice; add HNSW with AI implementation.

### 3.5 Schedule and resources

**`resources`**: `studio_id` FK NN, `type` enum `resource_type` NN, `name` NN (1–80), `description` (≤ 500), `is_active`, `deleted_at`.

**`schedule_entries`**

| Column          | Type                        | Notes                            |
| --------------- | --------------------------- | -------------------------------- |
| type            | enum schedule_entry_type NN | booking or block                 |
| booking_id      | uuid FK                     | Required khi `type = booking`    |
| resource_id     | uuid FK `resources`         |                                  |
| photographer_id | uuid FK                     |                                  |
| studio_id       | uuid FK                     | Owning studio / creator of block |
| during          | tstzrange NN                | `[start, end)`                   |
| title           | text                        |                                  |
| created_by      | uuid FK `profiles`          |                                  |

Confirmation creates one reservation per resource plus one for the photographer, sharing booking_id. schedule_entries reserves time; Booking.resourceIds derives from latest booking_resources snapshots. Cancellation deletes reservations but retains snapshots and booking times.

Constraints:

- XOR resource_id/photographer_id per row. type=booking iff booking_id is non-null.
- during is finite, non-empty [start,end), lower<upper. Booking intervals equal tstzrange(bookings.scheduled_start,bookings.scheduled_end,'[)'). Resource reservations require a studio booking and same-studio resources; personal bookings have none. Photographer matches current assignee/personal provider. Deferred triggers validate at commit, including schedule inserts/deletes: confirmed non-cancelled bookings have one photographer row and one per snapshot resource; cancelled bookings have none.
- Confirmation/reassignment/rescheduling lock and recheck booking, then update booking/schedule/snapshot/events atomically. Exclusion failures roll back everything and map to 409 slot_overlap.
- `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (resource_id IS NOT NULL)`
- `EXCLUDE USING gist (photographer_id WITH =, during WITH &&) WHERE (photographer_id IS NOT NULL)`
- Photographer exclusions prevent conflicts across studios and independent work; map violations to 409 slot_overlap.

### 3.6 Booking and Shoot Brief

**`bookings`**

| Column                                       | Type                                       | Notes                                                                                                    |
| -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| customer_id                                  | uuid NN FK profiles ON DELETE RESTRICT     | Preserve booking history when deleting accounts                                                          |
| provider_type                                | enum `provider_type` NN                    |                                                                                                          |
| photographer_id                              | uuid FK `photographers` ON DELETE RESTRICT | Khi `provider_type = photographer`                                                                       |
| studio_id                                    | uuid FK `studios` ON DELETE RESTRICT       | Khi `provider_type = studio`                                                                             |
| assigned_photographer_id                     | uuid FK photographers ON DELETE RESTRICT   | Required for studio bookings in confirmed/in_progress/proofing/delivered/completed; personal always null |
| service_id                                   | uuid FK services                           | ON DELETE SET NULL; source reference only                                                                |
| service_name                                 | text NN                                    | Snapshot                                                                                                 |
| service_price                                | integer NN                                 | Snapshot, ≥ 0                                                                                            |
| service_duration_minutes                     | integer NN                                 | Snapshot, > 0                                                                                            |
| service_photo_count, service_retouched_count | integer                                    | Booking-time package counts, null if unspecified, otherwise >=0                                          |
| total_price                                  | integer NN                                 | service_price + SUM(booking_add_ons.price), >=0, fixed at creation                                       |
| status                                       | enum booking_status NN default pending     | Service state machine only                                                                               |
| scheduled_start, scheduled_end               | timestamptz                                | Available from `confirmed`                                                                               |
| status_reason                                | text                                       |                                                                                                          |
| agreed_brief_version                         | integer                                    | (id,agreed_brief_version) FK to brief_versions(booking_id,version)                                       |

Check:

- Provider XOR: photographer requires photographer_id and null studio_id; studio requires studio_id and null photographer_id.
- In all states both scheduled timestamps are null or both present with end>start; explicitly check null cases.
- confirmed/in_progress/proofing/delivered/completed require both times; studio bookings in those states require assigned_photographer_id. Do not rely on enum ordering.
- Personal providers require null assignee and no booking_resources/resource reservations. Cancelled bookings retain prior times/assignee if set.
- in_progress/proofing/delivered/completed require agreed_brief_version; deferred trigger checks mutual approval.
- No deleted_at: bookings are retained and cancelled by state (contract 2.4).

Backend rejects self-booking and service/provider mismatch; assignee must be a current studio member. Snapshot service/add-ons and total_price atomically at creation; later service/brief.budget edits do not change price.

Prevent member departure/removal with pending/confirmed/in_progress/proofing/delivered assignments: 422 active_booking_assignment. Reassign in an allowed state or finish first. Trigger/backend checks lock studio consistently with assignment. Do not FK bookings to membership rows because history must outlive membership.

Customer/provider/assignee FKs restrict deletion. Since profiles cascades from Auth, deleting referenced Auth users is also blocked. Retain referenced accounts/profiles in MVP; studio soft deletion does not delete bookings.

Confirmation atomically changes state, reserves time, snapshots resources, records events, and creates Shoot Room. Other transitions atomically update all room/gallery/delivery/schedule effects and events; lock/recheck booking against concurrent transitions.

Assign/reassign only pending/confirmed/in_progress. Reject terminal and proofing-onward assignment changes. Pending has no reservations; confirmed/in_progress transfers photographer reservation with unchanged time/resources in one transaction; conflict rolls back and returns 409.

Reschedule only confirmed, by personal provider or studio manager. Preserve assignee; update booking/all reservations/resource snapshots atomically. Resources must be active, same-studio, and unique. No rescheduling from in_progress onward.

Index: `(customer_id, status)`, `(photographer_id, status)`, `(studio_id, status)`, `(assigned_photographer_id)`.

**booking_add_ons** (immutable creation snapshot): booking_id FK NN RESTRICT, add_on_id FK SET NULL, name NN, price NN >=0.

**booking_resources** (latest committed configuration): composite PK(booking_id,resource_id), no separate id.

| Column        | Type                                     | Notes                             |
| ------------- | ---------------------------------------- | --------------------------------- |
| booking_id    | uuid NN FK `bookings` ON DELETE RESTRICT |                                   |
| resource_id   | uuid NN FK resources ON DELETE RESTRICT  | Same studio as booking            |
| resource_name | text NN                                  | Name at confirmation/rescheduling |
| resource_type | enum resource_type NN                    | Type snapshot                     |

Create on confirmation; replace from current resources during allowed rescheduling in the same reservation transaction. Retain after cancellation/completion; resource rename/soft deletion never rewrites it. It is the latest configuration, not a full change log. Write only through confirmation/rescheduling; derive resourceIds here even after cancellation.

**booking_assignment_events** (append-only, created_at only, no updated_at)

| Column               | Type                                        | Notes                                       |
| -------------------- | ------------------------------------------- | ------------------------------------------- |
| booking_id           | uuid NN FK bookings ON DELETE RESTRICT      | Studio bookings only                        |
| from_photographer_id | uuid FK photographers ON DELETE RESTRICT    | Null for first assignment                   |
| to_photographer_id   | uuid NN FK photographers ON DELETE RESTRICT | Must differ from previous non-null assignee |
| actor_id             | uuid NN FK profiles ON DELETE RESTRICT      | Acting manager                              |
| created_at           | timestamptz NN                              | Assignment timestamp                        |

Record initial assignment via assignment/confirmation and all replacements with booking/schedule transaction. Same assignee is no-op, no event. Index (booking_id,created_at,id). Only manager reassigns. Access follows current assignee: old assignment access revoked, new assignee sees history; independent customer/manager access remains.

**brief_versions** (immutable except approval fields)

| Column                         | Type                    | Notes                                                                                    |
| ------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| booking_id                     | uuid NN FK              |                                                                                          |
| version                        | integer NN              | Starts at 1; UQ(booking_id,version)                                                      |
| created_by                     | uuid NN FK `profiles`   |                                                                                          |
| genre                          | `genre` NN              |                                                                                          |
| concept                        | text NN                 | 1–2000                                                                                   |
| location_type                  | enum `location_type` NN |                                                                                          |
| location_note                  | text                    | ≤ 300                                                                                    |
| preferred_start, preferred_end | timestamptz             |                                                                                          |
| people_count                   | integer                 | ≥ 1                                                                                      |
| reference_paths                | text[]                  | Maps content.references; at most 10 private brief-references paths {user_id}/{uuid}.webp |
| revision_rounds                | integer NN default 1    | Additional rounds after first; >=0                                                       |
| photo_count, retouched_count   | integer                 |                                                                                          |
| budget                         | integer                 |                                                                                          |
| notes                          | text                    | ≤ 1000                                                                                   |
| customer_approved_at           | timestamptz             |                                                                                          |
| provider_approved_at           | timestamptz             |                                                                                          |
| provider_approved_by           | uuid FK profiles        | Provider photographer or manager                                                         |

currentBriefVersion=max(version). Store agreed_brief_version in bookings and update only when newest version is mutually approved. New proposals do not clear old approvals/agreement; retain effective agreement until replaced. Null if none agreed.

Lock booking to allocate versions, create/approve, and update agreed pointer; recheck state/latest version transactionally. Record caller's side only, never both. New preferred times do not update reservations; use contract 12.2 rescheduling.

**booking_status_events** (accepted for MVP, append-only; no updated_at)

| Column                 | Type              | Notes                                                |
| ---------------------- | ----------------- | ---------------------------------------------------- |
| booking_id             | uuid NN FK        |                                                      |
| from_status, to_status | booking_status NN | Transitions only; no initial-creation event required |
| actor_id               | uuid FK profiles  | Null for system action, e.g. auto-completion         |
| reason                 | text              |                                                      |
| created_at             | timestamptz       |                                                      |

Supports audit, system messages, timeline, and future on-time metrics.

### 3.7 Shoot Room

**`shoot_rooms`**: `booking_id` UQ NN FK, `status` enum `shoot_room_status` (`open`, `closed`) NN default `open`, `closed_at`.
Do not store participant memberships; derive from booking with is_booking_participant(). Reassignment revokes old assignment rights and gives history to new assignee; independent customer/manager rights remain. API/RLS/Storage/Realtime recheck current access. Previously downloaded data cannot be recalled. Other studio member scope remains question #11.

**`messages`**

| Column        | Type                     | Notes                   |
| ------------- | ------------------------ | ----------------------- |
| shoot_room_id | uuid NN FK               |                         |
| sender_id     | uuid FK profiles         | Null for system message |
| type          | enum `message_type` NN   |                         |
| body          | text                     | ≤ 2000                  |
| is_hidden     | boolean NN default false | Admin moderation        |

Index (shoot_room_id,created_at desc,id desc). Require body or attachments. before=<messageId> anchors descending (created_at,id) within the same room. New IDs use UUIDv7 but cursor ordering still uses timestamps and id for same-millisecond consistency.

**message_attachments**: message_id FK NN, storage_path NN in private room-files, width, height. Derive image thumbnails from main path; non-image files have none. Trigger enforces <=5 attachments per message.

**decisions**: shoot_room_id FK NN, title NN 1–120, content NN 1–1000, decision_status default proposed, proposed_by FK NN, responded_by FK, responded_at. Require different responder; backend additionally checks opposite booking side.

**`milestones`**: `shoot_room_id` FK NN, `title` NN (1–120), `due_at`, `status` enum `milestone_status` default `todo`, `done_at`, `created_by` FK NN.

### 3.8 Proofing and delivery

**galleries**: booking_id UQ NN FK, gallery_status default draft, selection_limit integer (null unlimited), submitted_at, round integer NN default 1 CHECK >=1. Increment on accepted reopen, not submit; allowance comes from agreed brief revision_rounds, default 1.

**gallery_images**: gallery_id FK NN, storage_path NN in private gallery-previews, derived thumbnail, width/height, sort_order, is_selected NN default false. selectedCount counts selected rows. Per-round history remains #18; current design keeps latest selection.

**image_notes**: gallery_image_id FK NN, author_id FK NN, body NN 1–500, numeric x/y with 0<=x,y<=1 and matching nullability.

**`deliveries`**: `booking_id` UQ NN FK, `status` enum `delivery_status` default `preparing`, `note` (≤ 1000), `delivered_at`, `expires_at` (**[?]** #12).

**`delivery_items`**: `delivery_id` FK NN, `storage_path` NN (bucket `deliveries`), `file_name` NN, `mime_type` enum `delivery_mime_type` NN (`image/jpeg`, `image/png`, `image/webp`), `size_bytes` NN, `gallery_image_id` FK (set null).

### 3.9 Reviews and reports

**`reviews`**

| Column                     | Type                     | Notes                                                                       |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| booking_id                 | uuid NN UQ FK            | Unconditional unique for entire booking lifetime, including deleted reviews |
| reviewer_id                | uuid NN FK profiles      | Must match booking customer_id, checked by backend                          |
| target_type                | enum `provider_type` NN  |                                                                             |
| photographer_id, studio_id | uuid FK                  | XOR as services                                                             |
| rating                     | smallint NN              | 1–5                                                                         |
| comment                    | text                     | ≤ 1000                                                                      |
| is_hidden                  | boolean NN default false |                                                                             |
| deleted_at                 | timestamptz              |                                                                             |

Unconditional booking_id uniqueness: POST after soft deletion remains 409 already_exists. Recompute provider rating_avg/review_count with triggers, excluding deleted/hidden reviews.

**`reports`**

| Column      | Type                                | Notes                                              |
| ----------- | ----------------------------------- | -------------------------------------------------- |
| reporter_id | uuid NN FK `profiles`               |                                                    |
| target_type | enum `report_target_type` NN        |                                                    |
| target_id   | uuid NN                             | Polymorphic without FK; backend verifies existence |
| reason      | enum `report_reason` NN             |                                                    |
| detail      | text                                | ≤ 1000                                             |
| status      | enum `report_status` default `open` |                                                    |
| resolution  | enum `report_resolution`            |                                                    |
| admin_note  | text                                | ≤ 1000                                             |
| resolved_by | uuid FK `profiles`                  |                                                    |
| resolved_at | timestamptz                         |                                                    |

Partial unique (reporter_id,target_type,target_id) WHERE status='open' (409). content_hidden sets portfolios.status=hidden or is_hidden on portfolio_images/reviews/messages/photographers/studios.

---

## 4. RLS helpers (SECURITY DEFINER in a separate schema)

| Function                                                                 | Return                                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| has_role(uid,role)                                                       | client for existing profile; photographer from profile; studio_manager from manager membership in non-deleted studio; system_admin from user_roles |
| `is_studio_member(studio_id, uid)` / `is_studio_manager(studio_id, uid)` | boolean                                                                                                                                            |
| `is_booking_customer(booking_id, uid)`                                   | boolean                                                                                                                                            |
| is_booking_provider_side(booking_id,uid)                                 | Personal provider, current assigned photographer, or relevant studio manager; contract 2.5                                                         |
| is_booking_participant(booking_id,uid)                                   | Customer or provider side                                                                                                                          |
| shoot_room_booking_id(shoot_room_id)                                     | uuid for message/decision/milestone policies                                                                                                       |

Only current participants read booking_resources/booking_assignment_events via is_booking_participant(). Clients cannot write directly: confirmation/rescheduling updates snapshots, assignment transactions append events. History grants no access to old assignees.

Realtime channels shoot_room:{roomId} and booking:{bookingId} use the same RLS helpers.

---

## 5. Constraint and trigger summary

| #   | Requirement                                                         | Mechanism                                                                                              |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `updated_at`                                                        | Trigger chung                                                                                          |
| 2   | Active studio retains manager; atomic studio/first manager creation | Deferred studios/studio_members trigger, transaction, studio row lock                                  |
| 3   | Derived capabilities                                                | has_role checks profiles/membership; only admin stored in user_roles                                   |
| 4   | Resource/photographer overlap prevention                            | Exclusion constraints (3.5)                                                                            |
| 5   | XOR owner/provider/target                                           | Check constraint cho `services`, `portfolios`, `reviews`                                               |
| 6   | rating_avg/review_count                                             | Review triggers                                                                                        |
| 7   | price_from                                                          | Minimum active/non-deleted service trigger                                                             |
| 8   | <=5 attachments/message, <=10 references/brief                      | Trigger/check                                                                                          |
| 9   | Valid booking transitions                                           | Service state machine plus DB invariants                                                               |
| 10  | Reject writes to closed room                                        | RLS/backend checks status                                                                              |
| 11  | Portfolio cleanup after 30 days                                     | Delete files/thumbnails, image records, expired portfolio                                              |
| 12  | Studio creator/members need photographer profile                    | FK photographers(user_id), server checks                                                               |
| 13  | Unique valid username                                               | UQ + CHECK, normalization before write                                                                 |
| 14  | Controlled classifications/status                                   | DB enums aligned with contract 3.1, including tag_kind/tag_source/shoot_room_status/delivery_mime_type |
| 15  | Assignment/time match booking type/state                            | CHECK and deferred booking/schedule/brief triggers                                                     |
| 16  | No departure with active assignment                                 | Trigger/backend, consistent studio locking                                                             |
| 17  | Consistent schedule/snapshot/events/state                           | Transaction and booking lock; full rollback on conflict                                                |
| 18  | Retain booking/resource history                                     | FK RESTRICT, booking_resources snapshot, append-only assignment events                                 |
| 19  | One lifetime review per booking                                     | Unconditional unique reviews.booking_id                                                                |
| 20  | Image dimensions match API                                          | Each dimension (0,1280]; backend checks Storage metadata                                               |

---

## 6. Open decisions

Preserve question numbering for cross-references. Current unresolved items and previously resolved decisions follow.

Question #1 is compared in [Proposed ADR 0003](../adr/0003-auth-profile-initialization.md) and the [auth packet](../features/auth/packet.md). It remains unresolved; no business schema or migration is approved by that comparison.

| #   | Decision                                                                                                               | Owners                   |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Trigger versus backend profile initialization, username validation/duplicates/errors                                   | Ly, Khai                 |
| 2   | Free-text styles versus tags, taxonomy, annotation ownership                                                           | Quynh Anh, Ly            |
| 3   | Image count and per-account storage quotas                                                                             | Team                     |
| 4   | Free-text portfolio crew credit                                                                                        | Quynh Anh                |
| 5   | Additional trust metrics beyond ratings/counts                                                                         | Product owner            |
| 6   | Mandatory ai_generated labels                                                                                          | Product owner, Khoa      |
| 7   | Resolved: UUIDv7 IDs with (created_at,id) message cursors (3.7)                                                        | —                        |
| 8   | Resolved: manager assignment, block departure with active assignments, retain history (3.6)                            | —                        |
| 9   | Cancellation/completion timeout and proofing non-response; no cancellation from proofing                               | Product owner, Khai      |
| 10  | Resolved: briefs editable only pending/confirmed/in_progress, prior agreement effective until mutual replacement (3.6) | —                        |
| 11  | Shoot Room participants only versus all studio members                                                                 | Ly, Khai                 |
| 12  | Delivery/room quotas, file counts, retention                                                                           | Team                     |
| 13  | Review editing/provider replies/separate assigned-photographer reviews                                                 | Product owner            |
| 14  | Personal photographer schedule blocks                                                                                  | Product owner, Khoa      |
| 15  | Admin trust-inspection endpoints                                                                                       | Product owner, Quynh Anh |
| 16  | Deferred AI search permissions, grouping, search-uploads retention                                                     | Quynh Anh, Khai          |
| 17  | Push/email/in-app notifications, currently outside scope                                                               | Team                     |
| 18  | gallery_selections per-round history versus current selection                                                          | Product owner, Khoa      |

---

## Change history

| Version | Date       | Changes                                                                                                                                                                                                   |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0      | 2026-10-13 | Initial draft from API v0.2; not reviewed                                                                                                                                                                 |
| v0.1    | 2026-10-14 | Derived roles, display specialties, studio portfolios, 30-day cleanup, upload pairs/private references/revisions/events/price trigger; not frozen                                                         |
| v0.2    | 2026-10-14 | API v0.3 reconciliation: no booking deleted_at, explicit state checks, membership/profile constraints, hidden providers, reference_paths, FK conventions, open-question references, diagram relationships |
| v0.3    | 2026-10-20 | Signup roles, multiple studios, unique username, UUIDv7, enums                                                                                                                                            |

| v0.4 | 2026-10-20 | Assignment/time consistency, atomic scheduling, effective agreed brief, counts/resource snapshots, assignment events, FK RESTRICT |

| v0.5 | 2026-10-20 | Studio-only resources, lifetime review uniqueness, image size constraints |
| v0.6 | 2026-10-21 | English translation; distinguish deferred design from implemented foundation |
