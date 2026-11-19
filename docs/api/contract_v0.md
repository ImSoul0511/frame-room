# FrameRoom: MVP API Contract (draft v0)

MVP-001 implementation is documented in [the MVP contract](mvp.md). This historical
draft preserves original design questions and numbering; its foundation-only AI
deferral and GET /me initialization sketch do not describe the current implementation.

**Location:** `docs/api/contract_v0.md`. After v1 review, it may be split into common conventions and resource-specific files.
**Implemented contract source of truth:** Zod schemas in `packages/shared`. Resolve code/documentation mismatches in the same PR. Most business schemas below are still designs.

> **[?]** marks unresolved decisions, collected in section 20.
> **[Should]** sections specify endpoint/access/core fields only; extend additively under section 21.

---

## 1. Scope

This draft describes planned MVP business endpoints. Foundation implements only `GET /health`, which returns `{ "ok": true, "service": "api" }` without an envelope. AI implementation is deferred; other sections are not implemented merely because they appear here.

| Group                                      | Section | Priority                                         |
| ------------------------------------------ | ------- | ------------------------------------------------ |
| Personal profile                           | 4       | Must                                             |
| Photographer                               | 5       | Must                                             |
| Portfolios and images                      | 6, 7    | Must                                             |
| Explore and tags                           | 8       | Must                                             |
| Studio profiles, team, invitations         | 9       | Must                                             |
| Services and add-ons                       | 10      | Must                                             |
| Schedule and resources                     | 11      | Should                                           |
| Booking and Shoot Brief                    | 12      | Must                                             |
| Shoot Room messages, decisions, milestones | 13      | Must                                             |
| Photo selection / proofing                 | 14      | Must                                             |
| Delivery                                   | 15      | Must                                             |
| Review                                     | 16      | Must                                             |
| Content reporting and administration       | 17      | Should                                           |
| AI Search                                  | 18      | Deferred design; implementation is a later phase |
| Dashboard studio, timeline                 | 19      | Should (outline)                                 |

**Separate flows and exclusions:**

- Registration, login, logout, password reset: web calls Supabase Auth directly.
- Uploads: web uploads directly to Supabase Storage, then records the file through the API (2.6).
- Realtime messages: web subscribes to Supabase Realtime (2.7); sends still go through the API.
- Integrated payments, RAW storage, AI Concept Studio, Community Rooms, and push/email notifications **[?]** are outside the core MVP.

---

## 2. Common conventions

### 2.1 Basics

| Item           | Convention                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL       | `/v1`                                                                                                                                                     |
| Format         | JSON, `Content-Type: application/json`                                                                                                                    |
| Authentication | `Authorization: Bearer <Supabase access_token>`                                                                                                           |
| ID             | UUID string. New server-generated business IDs use UUIDv7. Preserve Supabase Auth IDs (`auth.users.id`, `Profile.id`, user FKs) and existing PK/FK values |
| Time           | ISO 8601 UTC, e.g. `2026-10-15T09:30:00Z`; half-open intervals `[start, end)`                                                                             |
| Field names    | JSON camelCase; backend maps database snake_case                                                                                                          |
| Enum values    | Controlled values from 3.1, usually snake_case; MIME uses standard values and SearchParsedKey follows JSON keys                                           |
| Currency       | Integer VND, e.g. 1500000; indicative/agreed amounts, no integrated payment                                                                               |
| Empty strings  | Do not use; absent nullable values are null                                                                                                               |
| Ordering       | Newest first unless an endpoint explicitly supports sort, e.g. sort=-createdAt                                                                            |

### 2.2 Response shapes

Single-object success:

```json
{ "data": {} }
```

Paginated list success:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 }
}
```

Page parameters: `?page=1&pageSize=20`; defaults 1/20, maximum pageSize 50 unless explicitly overridden.

Cursor pagination is used only for growing Shoot Room message history:

```json
{
  "data": [],
  "meta": { "limit": 30, "hasMore": true, "nextCursor": "<oldest returned message ID>" }
}
```

Parameters: `?limit=30&before=<messageId>`; default 30, maximum 100. New messages use UUIDv7, but order/cursor comparisons use descending `(created_at, id)` from the anchor message in the same room. UUIDv7 does not replace business timestamps.

### 2.3 Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "title", "message": "At most 120 characters" }]
  }
}
```

`details` is always an array. Entries may include `field`, machine-readable `reason`, and user-facing `message`. Reason is optional. Frontends must not branch on message text.

Schedule-conflict example:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Unable to confirm the schedule",
    "details": [
      {
        "reason": "slot_overlap",
        "message": "The photographer already has a reservation in this interval"
      }
    ]
  }
}
```

| HTTP | code                  | Meaning                                                                                     |
| ---- | --------------------- | ------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Invalid format or missing required input                                                    |
| 401  | `UNAUTHENTICATED`     | Missing or expired token                                                                    |
| 403  | `FORBIDDEN`           | Authenticated without permission                                                            |
| 404  | `NOT_FOUND`           | Missing resource or existence must be concealed                                             |
| 409  | `CONFLICT`            | Duplicate/conflicting state; details[].reason identifies slot_overlap, already_exists, etc. |
| 422  | `UNPROCESSABLE`       | Well-formed input violates a business rule, e.g. invalid transition                         |
| 429  | `RATE_LIMITED`        | Too many requests                                                                           |
| 500  | `INTERNAL_ERROR`      | Server failure                                                                              |
| 503  | `SERVICE_UNAVAILABLE` | Downstream dependency unavailable, e.g. future AI service                                   |

### 2.4 Update and deletion rules

- PATCH sends only changed fields; null clears a value only when nullable.
- Ignore client-supplied server fields: id, createdAt, updatedAt, userId, roles, priceFrom, publishedAt, round, and status when a dedicated transition endpoint exists.
- Derive user identity and authority from verified tokens and server-side relationships, never client role/userId claims.
- Successful DELETE returns 204. Deletion categories:
  - **Soft delete:** portfolios, studios, services, add-ons, resources, reviews. Portfolio deletion sets deletedAt and immediately excludes it from normal APIs; retain records/media for 30 days, then permanently clean portfolio/images/main files/thumbnails. No restore API/UI in MVP.
  - **Hard delete:** individually deleted portfolio images and gallery previews including both files; image notes, milestones, schedule blocks, delivery files, and departed/removed studio memberships.
  - **Bookings:** keep history; cancel by cancelled state, never delete as a substitute.
  - **Admin-hidden portfolios:** status=hidden is moderation, distinct from deletedAt.
- Soft-deleting a studio does not delete booking history. Booking media follows gallery/delivery rules.

### 2.5 Access notation

| Access                | Meaning                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Public                | No login required                                                                                              |
| Authenticated         | Valid token                                                                                                    |
| photographer          | Has photographer capability                                                                                    |
| Studio manager        | Current studio_members membership with role=manager                                                            |
| Studio member         | Current membership of that studio, any membership role                                                         |
| Booking customer      | The booking's customerId                                                                                       |
| Booking provider side | Personal provider photographer, current assigned photographer for a studio booking, or relevant studio manager |
| Booking participant   | Booking customer or provider side                                                                              |
| system_admin          | Manually provisioned system_admin role                                                                         |

Backend computes Profile.roles: client is always present; photographer derives from a photographer profile; studio_manager derives from manager membership in at least one non-deleted studio; only system_admin is stored separately and manually granted. Retoucher/art_director are profile metadata, not authorization.

Public registrationRole is client or photographer only. Studios have no separate accounts. Supabase Auth creates accounts; metadata is an onboarding preference, not a role grant. After a valid profile/username exists, create a photographer profile via POST /v1/photographers/me before creating a studio. Clients may use that flow to become photographers. No public admin-registration/grant API exists. All studio managers must be photographers.

At signup, send userName (required, same validation as Profile.userName), displayName, and registrationRole in Auth metadata. Server-side initialization revalidates them and never copies client roles/admin claims. Selecting photographer grants no capability until its profile is created.

### 2.6 Uploads and Storage

Web uploads to Storage then records storagePath (or a specifically named path field) through the API; responses expose URLs. Backend verifies bucket/path, file existence, and permission to use it. Arbitrary client URLs are not authoritative file references.

New frontend-generated file names use UUIDv7; {userId} retains the Supabase Auth ID.

Upload thumbnail-bearing images in pairs: {uuid}.webp (main, longest side at most 1280px) and {uuid}_thumb.webp (about 320px). Send only the main path; backend derives/checks both files. Applies to portfolio images, gallery previews, and Shoot Room image attachments, not delivery files. Complete missing uploads or clean partial files before recording the pair.

| Bucket           | Purpose                                               | Path                                                         | Read access                                                                  |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| avatars          | User/photographer/studio avatar                       | `{userId}/{uuid}.webp`                                       | Public to URL holders                                                        |
| profile-covers   | Photographer/studio cover; proposed additional bucket | `{userId}/{uuid}.webp`                                       | Public                                                                       |
| portfolio-images | Portfolio main/thumbnail                              | `{userId}/{portfolioId}/{uuid}.webp` and `{uuid}_thumb.webp` | Public, even draft/demo images; accepted MVP tradeoff, see README Demo media |
| gallery-previews | Selection previews                                    | `{bookingId}/{uuid}.webp` and `{uuid}_thumb.webp`            | Private, expiring signed URLs                                                |
| brief-references | Shoot Brief references                                | `{userId}/{uuid}.webp`                                       | Private, signed URLs                                                         |
| deliveries       | Final files                                           | `{bookingId}/{uuid}.{ext}`                                   | Private, signed URLs                                                         |
| room-files       | Shoot Room attachments                                | `{roomId}/{uuid}.{ext}`; images also `{uuid}_thumb.webp`     | Private, signed URLs                                                         |
| search-uploads   | Deferred AI references                                | `{userId}/{uuid}.webp`                                       | Private; 24-hour retention proposed **[?]**                                  |

Portfolio/preview mains: WebP, longest side at most 1280px, at most 2 MB; thumbnails about 320px. Backend checks actual Storage metadata against request dimensions; DB checks recorded dimensions are positive and <=1280. Delivery/room limits remain open (20). Storage RLS scopes writes to user/resource. Refresh private signed URLs through the API rather than persisting expired URLs.

### 2.7 Supabase Realtime

Business writes always use the API for permission/rule checks. Web only subscribes to changes; RLS determines access.

| Channel               | Events                                                        | Screen         |
| --------------------- | ------------------------------------------------------------- | -------------- |
| `shoot_room:{roomId}` | New messages/decisions, decision responses, milestone changes | Shoot Room     |
| `booking:{bookingId}` | Status changes/new brief versions                             | Booking detail |

Payloads match API objects/schemas. Refetch lists after reconnecting.

---

## 3. Shared data types

### 3.1 Enum

| Enum                | Values                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Role`              | `client`, `photographer`, `studio_manager`, `system_admin`; studio_manager is derived, not a signup account type          |
| `RegistrationRole`  | `client`, `photographer`                                                                                                  |
| `TagKind`           | `tone`, `setting`, `mood`; extend through synchronized enum changes                                                       |
| `TagSource`         | `manual`, `ai`                                                                                                            |
| `ShootRoomStatus`   | `open`, `closed`                                                                                                          |
| `BookingSide`       | `customer`, `provider`                                                                                                    |
| `SearchParsedKey`   | `genres`, `styles`, `city`, `district`, `priceMax`                                                                        |
| `TimelineItemType`  | `shoot`, `milestone`                                                                                                      |
| `DeliveryMimeType`  | `image/jpeg`, `image/png`, `image/webp`                                                                                   |
| `Genre`             | `portrait`, `fashion`, `wedding`, `family`, `product`, `food`, `event`, `cosplay`                                         |
| `PortfolioStatus`   | `draft`, `published`, `hidden`; only admins set hidden                                                                    |
| `Provenance`        | `captured` (photograph), `manipulated` (heavy editing/compositing), `ai_generated` (generated)                            |
| `ProviderType`      | `photographer`, `studio`                                                                                                  |
| `StudioMemberRole`  | `manager`, `photographer`; membership roles, not display specialties                                                      |
| `ProfessionalRole`  | `retoucher`, `art_director`; display metadata without permissions                                                         |
| `InvitationStatus`  | `pending`, `accepted`, `declined`, `revoked`                                                                              |
| `ResourceType`      | `room`, `equipment`                                                                                                       |
| `ScheduleEntryType` | `booking`, `block`                                                                                                        |
| `BookingStatus`     | `pending`, `confirmed`, `rejected`, `cancelled`, `in_progress`, `proofing`, `delivered`, `completed`; transitions in 12.4 |
| `LocationType`      | `studio`, `outdoor`, `client_site`                                                                                        |
| `MessageType`       | `text`, `image`, `system`                                                                                                 |
| `DecisionStatus`    | `proposed`, `agreed`, `rejected`                                                                                          |
| `MilestoneStatus`   | `todo`, `done`                                                                                                            |
| `GalleryStatus`     | `draft`, `open_for_selection`, `selection_submitted`, `finalized`                                                         |
| `DeliveryStatus`    | `preparing`, `delivered`                                                                                                  |
| `ReportTargetType`  | `portfolio`, `portfolio_image`, `photographer`, `studio`, `review`, `message`                                             |
| `ReportReason`      | `inappropriate`, `copyright`, `ai_unlabeled`, `spam`, `harassment`, `other`                                               |
| `ReportStatus`      | `open`, `resolved`                                                                                                        |
| `ReportResolution`  | `dismissed`, `content_hidden`                                                                                             |

> Genre follows the proposal. Detailed style taxonomy (cool tones, film, etc.) awaits Quynh Anh; initial free-text styles remain **[?]**. Standard tags (8.2) allow annotation once taxonomy is ready. ProfessionalRole neither grants permissions nor participates in assignment workflows.

### 3.2 Objects

**Profile** (current user)

| Field          | Type           | Notes                                                                                            |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| id             | uuid           | Same as auth.users.id                                                                            |
| email          | string         | Read-only                                                                                        |
| userName       | string         | Globally unique; trim/lowercase, 3–30 characters, `^[a-z0-9][a-z0-9_]{2,29}$`; URL /u/{userName} |
| displayName    | string         | 1–60 characters                                                                                  |
| avatarUrl      | string \| null |                                                                                                  |
| roles          | Role[]         | Computed from profile/membership; only system_admin stored separately                            |
| photographerId | uuid \| null   | Null without a photographer profile                                                              |
| createdAt      | datetime       |                                                                                                  |

**UserSummary** (public user representation, no email)

| Field       | Type           |
| ----------- | -------------- |
| id          | uuid           |
| userName    | string         |
| displayName | string         |
| avatarUrl   | string \| null |

**PhotographerSummary**

| Field       | Type           | Notes                                     |
| ----------- | -------------- | ----------------------------------------- |
| id          | uuid           | Photographer profile ID                   |
| userId      | uuid           |                                           |
| userName    | string         | Derived from user profile, not duplicated |
| displayName | string         |                                           |
| avatarUrl   | string \| null |                                           |

**StudioSummary**

| Field     | Type           |
| --------- | -------------- |
| id        | uuid           |
| name      | string         |
| avatarUrl | string \| null |

**ProviderSummary** (photographer or studio, used by Explore/deferred search)

| Field       | Type           | Notes                             |
| ----------- | -------------- | --------------------------------- |
| type        | ProviderType   |                                   |
| id          | uuid           | Photographer profile or studio ID |
| displayName | string         | Studio name for studio providers  |
| avatarUrl   | string \| null |                                   |

**Photographer**

| Field                | Type               | Notes                                                                |
| -------------------- | ------------------ | -------------------------------------------------------------------- |
| id                   | uuid               |                                                                      |
| userId               | uuid               | Profile owner                                                        |
| userName             | string             | Derived from profile; /u/{userName}; editable only through PATCH /me |
| displayName          | string             | 1–60 characters                                                      |
| avatarUrl            | string \| null     |                                                                      |
| bio                  | string \| null     | At most 1000 characters                                              |
| genres               | Genre[]            | 1–5 genres                                                           |
| styles               | string[]           | At most 10 tags, each at most 30 characters **[?]**                  |
| professionalRoles    | ProfessionalRole[] | Display specialties only, no authorization/workflow impact           |
| city                 | string \| null     | Example "Ho Chi Minh City"                                           |
| district             | string \| null     | Example "Thu Duc"                                                    |
| priceFrom            | integer \| null    | Read-only minimum active-service price; null without active services |
| coverImageUrl        | string \| null     | Photographer cover                                                   |
| portfolioCount       | integer            | Published portfolio count                                            |
| ratingAvg            | number \| null     | 1.0–5.0, one decimal; null without reviews                           |
| reviewCount          | integer            |                                                                      |
| isHidden             | boolean            | Owner/admin only; hidden profiles excluded publicly (17)             |
| createdAt, updatedAt | datetime           |                                                                      |

**Portfolio**

| Field                | Type             | Notes                                                                   |
| -------------------- | ---------------- | ----------------------------------------------------------------------- |
| id                   | uuid             |                                                                         |
| ownerType            | ProviderType     | photographer or studio                                                  |
| photographerId       | uuid \| null     | Present when `ownerType = photographer`                                 |
| studioId             | uuid \| null     | Present when `ownerType = studio`                                       |
| title                | string           | 1–120 characters                                                        |
| genre                | Genre            |                                                                         |
| description          | string \| null   | At most 2000 characters, concept/notes                                  |
| status               | PortfolioStatus  | Default `draft`                                                         |
| coverImageId         | uuid \| null     | Image within this portfolio; backend validates ownership                |
| coverImageUrl        | string \| null   | Cover URL; falls back to first image                                    |
| imageCount           | integer          |                                                                         |
| images               | PortfolioImage[] | Detail response only, GET /portfolios/:id                               |
| publishedAt          | datetime \| null | Latest publication; set on publish, clear on draft, update on republish |
| createdAt, updatedAt | datetime         |                                                                         |

**PortfolioImage**

| Field         | Type           | Notes                                                              |
| ------------- | -------------- | ------------------------------------------------------------------ |
| id            | uuid           |                                                                    |
| portfolioId   | uuid           |                                                                    |
| url           | string         | Image display URL                                                  |
| thumbnailUrl  | string         | URL thumbnail                                                      |
| isHidden      | boolean        | Status exposed only to owner/admin; hidden images omitted publicly |
| width, height | integer        | Pixel                                                              |
| caption       | string \| null | At most 300 characters                                             |
| provenance    | Provenance     | Default `captured`                                                 |
| tags          | Tag[]          | Read-only in v0.2; assignment mechanism **[?]**                    |
| sortOrder     | integer        | Starts at 0                                                        |
| createdAt     | datetime       |                                                                    |

---

## 4. Personal profile

### GET /v1/me

**Purpose:** Return the current user's profile and roles.
**Screens:** Authenticated app initialization and menu selection.
**Access:** Authenticated.
**Response 200:**

```json
{
  "data": {
    "id": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11",
    "email": "an@example.com",
    "userName": "nguyen_an",
    "displayName": "An Nguyen",
    "avatarUrl": null,
    "roles": ["client", "photographer"],
    "photographerId": "019e2310-0000-7000-8000-000000000004",
    "createdAt": "2026-10-14T03:12:00Z"
  }
}
```

**Errors:** 400, 401, 409 user_name_taken if initialization occurs here.
**Notes:** If first GET /me initializes the profile, validate signup metadata username first. Derive client capability. Require a valid, globally unique userName before onboarding completes; do not publish email as username. Enforce uniqueness atomically: 409 user_name_taken for duplicates, 400 for invalid format. Trigger versus backend initialization and error delivery remain open (20); never create a profile without username.

### GET /v1/users/by-username/:userName

**Purpose:** Resolve profile URL /u/{userName}.
**Access:** Public.
**Response 200:** `{ "data": UserSummary & { "photographerId": uuid | null } }`; omit email/roles. Return null photographerId for hidden photographer profiles.
**Errors:** 400 invalid format, 404 missing.
**Notes:** Trim/lowercase lookup. Renaming makes old URLs return 404; no alias/redirect in MVP.

### PATCH /v1/me

**Purpose:** Update username, display name, and avatar.
**Screens:** Account settings.
**Access:** Authenticated, self only.
**Request body:**

| Field             | Type           | Required | Notes                                                   |
| ----------------- | -------------- | -------- | ------------------------------------------------------- |
| userName          | string         | no       | Same constraints as Profile.userName; not nullable      |
| displayName       | string         | no       | 1–60 characters                                         |
| avatarStoragePath | string \| null | no       | Uploaded avatars path; null removes avatar if supported |

```json
{ "displayName": "An Nguyen" }
```

**Response 200:** `{ "data": Profile }`
**Errors:** 400, 401, 409 with details[].reason=user_name_taken after normalization.

### GET /v1/me/studios

**Purpose:** List non-deleted studios the user currently belongs to, with membership role.
**Screens:** Studio switcher/management.
**Access:** Authenticated.
**Response 200:** `{ "data": [{ "studio": StudioSummary, "role": StudioMemberRole }] }` (unpaginated).
**Errors:** 401.

---

## 5. Photographer

### GET /v1/photographers

**Purpose:** List public photographers.
**Screens:** Photographer list and Explore filters.
**Access:** Public.
**Query:**

| Parameter      | Type    | Notes                         |
| -------------- | ------- | ----------------------------- |
| genre          | Genre   | Filter one genre              |
| city           | string  |                               |
| district       | string  |                               |
| studioId       | uuid    | Members of this studio only   |
| q              | string  | Name substring search, not AI |
| page, pageSize | integer | See 2.2                       |

**Response 200:**

```json
{
  "data": [
    {
      "id": "019e2310-0000-7000-8000-000000000004",
      "userId": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11",
      "userName": "nguyen_an",
      "displayName": "An Studio",
      "avatarUrl": null,
      "bio": "Specializing in cool-tone portraits.",
      "genres": ["portrait", "fashion"],
      "styles": ["cool tones", "film"],
      "professionalRoles": ["retoucher", "art_director"],
      "city": "Ho Chi Minh City",
      "district": "Thu Duc",
      "priceFrom": 1500000,
      "coverImageUrl": "https://.../cover.webp",
      "portfolioCount": 3,
      "ratingAvg": 4.8,
      "reviewCount": 12,
      "createdAt": "2026-10-14T03:12:00Z",
      "updatedAt": "2026-10-14T03:12:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

**Errors:** 400.

### GET /v1/photographers/:id

**Purpose:** Photographer details with published portfolios and current studios.
**Screens:** Photographer profile.
**Access:** Public.
**Response 200:** `{ "data": Photographer & { "portfolios": Portfolio[], "studios": StudioSummary[] } }`; published portfolios only, without images.
**Errors:** 404.

### POST /v1/photographers/me

**Purpose:** Create the caller's photographer profile; derive /me.roles photographer capability, do not duplicate it as a stored role.
**Screens:** Photographer onboarding.
**Access:** Authenticated without an existing photographer profile.
**Request body:**

| Field             | Type               | Required | Notes                                                 |
| ----------------- | ------------------ | -------- | ----------------------------------------------------- |
| displayName       | string             | yes      | 1–60 characters                                       |
| bio               | string             | no       | At most 1000 characters                               |
| genres            | Genre[]            | yes      | 1–5 items                                             |
| styles            | string[]           | no       | At most 10                                            |
| professionalRoles | ProfessionalRole[] | no       | Display specialties only, e.g. retoucher/art_director |
| city              | string             | no       |                                                       |
| district          | string             | no       |                                                       |
| avatarStoragePath | string             | no       | avatars bucket path                                   |
| coverStoragePath  | string             | no       | profile-covers bucket path                            |

Do not accept priceFrom input; backend/DB derives it from the photographer's lowest active service price.

```json
{
  "displayName": "An Studio",
  "bio": "Specializing in cool-tone portraits.",
  "genres": ["portrait", "fashion"],
  "styles": ["cool tones", "film"],
  "professionalRoles": ["retoucher", "art_director"],
  "city": "Ho Chi Minh City",
  "district": "Thu Duc",
  "avatarStoragePath": "user-123/avatar.webp",
  "coverStoragePath": "user-123/cover.webp"
}
```

**Response 201:** `{ "data": Photographer }`
**Errors:** 400, 401, 409 CONFLICT for an existing profile.

### PATCH /v1/photographers/me

**Purpose:** Update the caller's photographer profile.
**Screens:** Photographer profile editor.
**Access:** photographer, self only.
**Request body:** Editable POST fields, all optional. Accept avatarStoragePath/coverStoragePath, not URLs. priceFrom remains read-only.
**Response 200:** `{ "data": Photographer }`
**Errors:** 400, 401, 403, 404.

---

## 6. Portfolio

### GET /v1/portfolios

**Purpose:** List portfolios.
**Screens:** My portfolios, photographer/studio portfolios.
**Access:** Published portfolios are public. Authenticated mine=true includes caller-owned personal portfolios and managed-studio portfolios, including marked draft/hidden items. Exclude soft-deleted portfolios.
**Query:**

| Parameter      | Type            | Notes                                   |
| -------------- | --------------- | --------------------------------------- |
| photographerId | uuid            | Filter photographer portfolios          |
| studioId       | uuid            | Filter studio portfolios                |
| genre          | Genre           |                                         |
| mine           | boolean         | Include own portfolios, including draft |
| status         | PortfolioStatus | Only with mine=true                     |
| page, pageSize | integer         |                                         |

**Response 200:** `{ "data": Portfolio[], "meta": {...} }`, without images.
**Errors:** 400, 401 for unauthenticated mine=true.

### GET /v1/portfolios/:id

**Purpose:** Portfolio details and all images.
**Screens:** Portfolio detail.
**Access:** Public when published; draft/hidden only for owner/admin. Soft-deleted portfolios are excluded from normal APIs and return 404.
**Response 200:**

```json
{
  "data": {
    "id": "019e2310-0000-7000-8000-000000000007",
    "ownerType": "photographer",
    "photographerId": "019e2310-0000-7000-8000-000000000004",
    "studioId": null,
    "title": "Winter portraits",
    "genre": "portrait",
    "description": "Cool tones and window light.",
    "status": "published",
    "coverImageId": "019e2310-0000-7000-8000-000000000003",
    "coverImageUrl": "https://.../img1.webp",
    "imageCount": 2,
    "publishedAt": "2026-10-14T04:05:00Z",
    "images": [
      {
        "id": "019e2310-0000-7000-8000-000000000003",
        "portfolioId": "019e2310-0000-7000-8000-000000000007",
        "url": "https://.../img1.webp",
        "thumbnailUrl": "https://.../img1_thumb.webp",
        "width": 853,
        "height": 1280,
        "caption": "Morning window",
        "provenance": "captured",
        "tags": [],
        "sortOrder": 0,
        "isHidden": false,
        "createdAt": "2026-10-14T04:00:00Z"
      }
    ],
    "createdAt": "2026-10-14T03:50:00Z",
    "updatedAt": "2026-10-14T04:05:00Z"
  }
}
```

**Errors:** 404 for missing or inaccessible portfolios.

### POST /v1/portfolios

**Purpose:** Create a draft portfolio.
**Screens:** Portfolio creation.
**Access:** `photographer`.
**Request body:**

| Field       | Type   | Required | Notes                   |
| ----------- | ------ | -------- | ----------------------- |
| title       | string | yes      | 1–120 characters        |
| genre       | Genre  | yes      |                         |
| description | string | no       | At most 2000 characters |

```json
{ "title": "Winter portraits", "genre": "portrait", "description": "Cool-tone concept." }
```

**Response 201:** `{ "data": Portfolio }`
**Errors:** 400, 401, 403.
**Notes:** ownerType=photographer; derive photographerId from authenticated identity, never client input.

### POST /v1/studios/:id/portfolios

**Purpose:** Create a studio-owned draft portfolio.
**Access:** Relevant studio manager.
**Request body:** `title`, `genre` (required); `description` (optional).
**Response 201:** `{ "data": Portfolio }` with ownerType=studio, studioId from URL, photographerId=null.
**Errors:** 400, 401, 403, 404.

### PATCH /v1/portfolios/:id

**Purpose:** Edit metadata or publish/unpublish.
**Screens:** Portfolio editor.
**Access:** Owning photographer or manager of owning studio.
**Request body:** Optional title, genre, description, status (draft/published), coverImageId. Do not accept coverImageUrl/publishedAt. Verify ownership and current manager membership for studio portfolios.
**Response 200:** `{ "data": Portfolio }`
**Errors:** 400, 401, 403, 404, 422.
**Notes:** Publishing requires at least one image (422 otherwise). Owners cannot republish admin-hidden portfolios (422).

### DELETE /v1/portfolios/:id

**Purpose:** Set deletedAt, immediately exclude the portfolio from normal APIs, and queue cleanup after 30 days.
**Access:** Owning photographer or relevant studio manager.
**Response 204:** No content; no restore API in MVP.
**Errors:** 401, 403, 404.

---

## 7. Portfolio images

**Frontend upload flow:**

1. Create a WebP main image (longest side <=1280px, <=2 MB) and WebP thumbnail (about 320px).
2. Upload `{userId}/{portfolioId}/{uuid}.webp` and `{userId}/{portfolioId}/{uuid}_thumb.webp` to public portfolio-images.
3. Call POST /v1/portfolios/:id/images with main storagePath; backend derives/checks the thumbnail.

Storage RLS permits writes only under the caller's userId folder. Public portfolio URLs remain readable regardless of isHidden/status; those flags affect API visibility only. This is an accepted MVP tradeoff.

### POST /v1/portfolios/:id/images

**Purpose:** Record an uploaded portfolio image.
**Screens:** Portfolio creation/editing.
**Access:** Owning photographer or manager of owning studio.
**Request body:**

| Field       | Type       | Required | Notes                  |
| ----------- | ---------- | -------- | ---------------------- |
| storagePath | string     | yes      | Path within bucket     |
| width       | integer    | yes      |                        |
| height      | integer    | yes      |                        |
| caption     | string     | no       | At most 300 characters |
| provenance  | Provenance | no       | Default `captured`     |

```json
{
  "storagePath": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11/019e2310-0000-7000-8000-000000000007/019e2310-0000-7000-8000-000000000008.webp",
  "width": 853,
  "height": 1280,
  "caption": "Morning window",
  "provenance": "captured"
}
```

**Response 201:** `{ "data": PortfolioImage }`
**Errors:** 400, 401, 403, 404, 422 for missing Storage objects or exceeded image quota **[?]**.
**Notes:** Validate caller-owned folder and portfolio path, actual metadata, both files, size/dimensions. Width/height must match actual image and each be 1–1280px. Default sortOrder appends.

### PATCH /v1/portfolios/:id/images/:imageId

**Purpose:** Edit caption, provenance, or order.
**Access:** Owning photographer or relevant studio manager.
**Request body:** Optional caption, provenance, sortOrder.
**Response 200:** `{ "data": PortfolioImage }`
**Errors:** 400, 401, 403, 404.

### DELETE /v1/portfolios/:id/images/:imageId

**Purpose:** Hard-delete image record, main file, and thumbnail.
**Access:** Owning photographer or relevant studio manager.
**Response 204.**
**Errors:** 401, 403, 404.

---

## 8. Explore and tags

### 8.1 GET /v1/explore

**Purpose:** Recently published portfolio feed for the home screen.
**Screens:** Home/Explore.
**Access:** Public.
**Query:** `genre`, `page`, `pageSize` (see 2.2).
**Response 200:**

```json
{
  "data": [
    {
      "portfolioId": "019e2310-0000-7000-8000-000000000007",
      "title": "Winter portraits",
      "genre": "portrait",
      "ownerType": "photographer",
      "coverImageUrl": "https://.../img1.webp",
      "owner": {
        "type": "photographer",
        "id": "019e2310-0000-7000-8000-000000000004",
        "displayName": "An Nguyen Photography",
        "avatarUrl": null
      },
      "publishedAt": "2026-10-14T04:05:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

**Errors:** 400.
**Notes:** owner is ProviderSummary selected by ownerType. Newest first. Natural-language search is the separate deferred POST /v1/search endpoint (18); do not overload q here.

### 8.2 Tag

**Tag**

| Field | Type    | Notes                                        |
| ----- | ------- | -------------------------------------------- |
| id    | uuid    |                                              |
| slug  | string  | Example `tone-lanh`                          |
| name  | string  | Display name                                 |
| kind  | TagKind | tone/setting/mood; detailed taxonomy pending |

### GET /v1/tags

**Purpose:** List standard tags for filtering/suggestions.
**Screens:** Explore/Search filters and image tagging.
**Access:** Public.
**Query:** kind: TagKind, q (name match), page, pageSize (maximum 100 here).
**Response 200:** `{ "data": Tag[], "meta": {...} }`
**Errors:** 400.

---

## 9. Studio

**Studio**

| Field                    | Type            | Notes                                                    |
| ------------------------ | --------------- | -------------------------------------------------------- |
| id                       | uuid            |                                                          |
| name                     | string          | 1–80 characters                                          |
| description              | string \| null  | At most 2000 characters                                  |
| avatarUrl, coverImageUrl | string \| null  | Display URLs in responses                                |
| genres                   | Genre[]         | 1–5 genres                                               |
| city, district           | string \| null  |                                                          |
| address                  | string \| null  | At most 200 characters                                   |
| priceFrom                | integer \| null | Read-only minimum active-service price; null if none     |
| memberCount              | integer         |                                                          |
| portfolioCount           | integer         | Studio's published portfolios                            |
| ratingAvg                | number \| null  | Same as Photographer                                     |
| reviewCount              | integer         |                                                          |
| isHidden                 | boolean         | Owner/admin only; hidden profiles excluded publicly (17) |
| createdAt, updatedAt     | datetime        |                                                          |

**StudioMember**

| Field          | Type             | Notes                                                      |
| -------------- | ---------------- | ---------------------------------------------------------- |
| id             | uuid             | Membership row ID                                          |
| studioId       | uuid             |                                                            |
| userId         | uuid             |                                                            |
| userName       | string           | Derived from user profile, not duplicated                  |
| displayName    | string           |                                                            |
| avatarUrl      | string \| null   |                                                            |
| photographerId | uuid             | Always present, including managers; derived through userId |
| role           | StudioMemberRole |                                                            |
| joinedAt       | datetime         |                                                            |

**StudioInvitation**

| Field                  | Type                | Notes                  |
| ---------------------- | ------------------- | ---------------------- |
| id                     | uuid                |                        |
| studio                 | StudioSummary       |                        |
| photographer           | PhotographerSummary | Invitee                |
| role                   | StudioMemberRole    | Default `photographer` |
| status                 | InvitationStatus    |                        |
| createdAt, respondedAt | datetime \| null    |                        |

| Endpoint                                           | Purpose / screen                       | Access                 | Request                                                                                                   | Response / errors                                                           |
| -------------------------------------------------- | -------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /v1/studios`                                  | List studios / Explore                 | Public                 | genre, city, district, q, page, pageSize                                                                  | 200 Studio[] + meta; 400                                                    |
| `GET /v1/studios/:id`                              | Studio profile                         | Public                 |                                                                                                           | 200 Studio; 404                                                             |
| `POST /v1/studios`                                 | Create studio and first manager        | photographer           | Required name, genres; optional description, city, district, address, avatarStoragePath, coverStoragePath | 201 Studio; 400, 401, 403 without photographer profile                      |
| `PATCH /v1/studios/:id`                            | Edit studio profile                    | Studio manager         | Optional POST fields; no priceFrom or URLs                                                                | 200 Studio; 400, 401, 403, 404                                              |
| `DELETE /v1/studios/:id`                           | Soft-delete studio                     | Studio manager         |                                                                                                           | 204; 401, 403, 404, 422 with unfinished bookings                            |
| `GET /v1/studios/:id/members`                      | Public team                            | Public                 |                                                                                                           | 200 StudioMember[], unpaginated; 404                                        |
| `PATCH /v1/studios/:id/members/:memberId`          | Change membership role                 | Studio manager         | role                                                                                                      | 200 StudioMember; 400, 401, 403, 404, 422 if no manager would remain        |
| `DELETE /v1/studios/:id/members/:memberId`         | Remove membership or leave             | Studio manager or self |                                                                                                           | 204; 401, 403, 404, 422 for last manager or active_booking_assignment       |
| `GET /v1/studios/:id/invitations`                  | Sent invitations                       | Studio manager         | status, page, pageSize                                                                                    | 200 StudioInvitation[] + meta; 401, 403, 404                                |
| `POST /v1/studios/:id/invitations`                 | Invite photographer                    | Studio manager         | Required photographerId; optional role                                                                    | 201 StudioInvitation; 400, 401, 403, 404, 409 already member/pending invite |
| `DELETE /v1/studios/:id/invitations/:invitationId` | Revoke, retain row with revoked status | Studio manager         |                                                                                                           | 204; 401, 403, 404, 422 already responded                                   |
| `GET /v1/me/invitations`                           | Received invitations                   | photographer           | status, page, pageSize                                                                                    | 200 StudioInvitation[] + meta; 401, 403                                     |
| `POST /v1/invitations/:id/accept`                  | Accept; create studio_members row      | Invited photographer   |                                                                                                           | 200 StudioMember; 401, 403, 404, 422 no longer pending                      |
| `POST /v1/invitations/:id/decline`                 | Decline                                | Invited photographer   |                                                                                                           | 204; 401, 403, 404, 422                                                     |

**Notes:**

- A photographer may create/join multiple studios with different roles, and a studio may have multiple managers. Do not uniquely constrain creator or user independently.
- Studios independently own profiles, services, portfolios, and bookings. All members/managers require photographer profiles; studios have no separate credentials.
- Derive creator from token; create studio (immutable created_by) and initial manager membership atomically. Derive studio_manager from current membership in non-deleted studios; do not store a duplicate role.
- Assigned photographers cannot leave/be removed while bookings are pending, confirmed, in_progress, proofing, or delivered: 422 active_booking_assignment. Reassign in an allowed state or finish first. Lock studio consistently with assignment to prevent races.
- Departed founders lose management authority. Active studios must retain a manager even during concurrent departures; lock the studio row and validate at commit.
- Compute priceFrom from active services; reject it as input.
- Invite by photographerId; email invitations are deferred **[?]**.
- Assignment permissions: section 12 and decision 20 #8.

---

## 10. Services and add-ons

**Service**

| Field                | Type            | Notes                                          |
| -------------------- | --------------- | ---------------------------------------------- |
| id                   | uuid            |                                                |
| ownerType            | ProviderType    | photographer or studio service owner           |
| photographerId       | uuid \| null    | Present when `ownerType = photographer`        |
| studioId             | uuid \| null    | Present when `ownerType = studio`              |
| name                 | string          | 1–100 characters                               |
| description          | string \| null  | At most 1000 characters                        |
| genre                | Genre           |                                                |
| durationMinutes      | integer         | > 0                                            |
| price                | integer         | >=0, indicative VND                            |
| photoCount           | integer \| null | Expected delivered images                      |
| retouchedCount       | integer \| null | Detailed retouched images                      |
| isActive             | boolean         | False hides publicly and prevents new bookings |
| addOns               | AddOn[]         |                                                |
| createdAt, updatedAt | datetime        |                                                |

**AddOn**

| Field       | Type           | Notes                  |
| ----------- | -------------- | ---------------------- |
| id          | uuid           |                        |
| serviceId   | uuid           |                        |
| name        | string         | 1–100 characters       |
| description | string \| null | At most 500 characters |
| price       | integer        | ≥ 0                    |
| isActive    | boolean        |                        |

| Endpoint                                   | Purpose / screen                          | Access                               | Request                                                                                                  | Response / errors               |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `GET /v1/photographers/:id/services`       | Photographer services / booking selection | Public active services               | genre; includeInactive only for owner                                                                    | 200 Service[], unpaginated; 404 |
| `GET /v1/studios/:id/services`             | Studio services                           | Public active services               | Same; includeInactive manager-only                                                                       | 200 Service[]; 404              |
| `GET /v1/services/:id`                     | Service detail                            | Public when active                   |                                                                                                          | 200 Service; 404                |
| `POST /v1/photographers/me/services`       | Create personal service                   | photographer                         | Required name, genre, durationMinutes, price; optional description, photoCount, retouchedCount, isActive | 201 Service; 400, 401, 403      |
| `POST /v1/studios/:id/services`            | Create studio service                     | Studio manager                       | Same as above                                                                                            | 201 Service; 400, 401, 403, 404 |
| `PATCH /v1/services/:id`                   | Edit service                              | Owning photographer / studio manager | Optional POST fields                                                                                     | 200 Service; 400, 401, 403, 404 |
| `DELETE /v1/services/:id`                  | Soft-delete service                       | Service owner                        |                                                                                                          | 204; 401, 403, 404              |
| `POST /v1/services/:id/add-ons`            | Add add-on                                | Service owner                        | Required name, price; optional description, isActive                                                     | 201 AddOn; 400, 401, 403, 404   |
| `PATCH /v1/services/:id/add-ons/:addOnId`  | Edit add-on                               | Service owner                        | Optional POST fields                                                                                     | 200 AddOn; 400, 401, 403, 404   |
| `DELETE /v1/services/:id/add-ons/:addOnId` | Soft-delete add-on                        | Service owner                        |                                                                                                          | 204; 401, 403, 404              |

**Notes:** Snapshot service name, price, duration, photo/retouched counts, and add-on names/prices at booking. Later service changes/deletion do not change snapshots or total price.

---

## 11. Schedule and resources [Should]

Prevent overlaps when confirming studio bookings; this is a high-level design.

**Resource**

| Field       | Type           | Notes                  |
| ----------- | -------------- | ---------------------- |
| id          | uuid           |                        |
| studioId    | uuid           |                        |
| type        | ResourceType   |                        |
| name        | string         | 1–80 characters        |
| description | string \| null | At most 500 characters |
| isActive    | boolean        |                        |

**ScheduleEntry**

| Field          | Type              | Notes                                                          |
| -------------- | ----------------- | -------------------------------------------------------------- |
| id             | uuid              |                                                                |
| type           | ScheduleEntryType | booking (created on confirmation) or manual block              |
| bookingId      | uuid \| null      | Present when `type = booking`                                  |
| resourceId     | uuid \| null      |                                                                |
| photographerId | uuid \| null      |                                                                |
| studioId       | uuid \| null      |                                                                |
| start, end     | datetime          | Half-open [start, end)                                         |
| title          | string \| null    | Booking titles visible only to participants and studio members |

| Endpoint                                               | Purpose / screen                | Access         | Request                                                                | Response / errors                                                  |
| ------------------------------------------------------ | ------------------------------- | -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /v1/studios/:id/resources`                        | Rooms/equipment                 | Studio member  | type, includeInactive                                                  | 200 Resource[]; 401, 403, 404                                      |
| `POST /v1/studios/:id/resources`                       | Add resource                    | Studio manager | Required type, name; optional description                              | 201 Resource; 400, 401, 403, 404                                   |
| `PATCH /v1/studios/:id/resources/:resourceId`          | Edit resource                   | Studio manager | POST fields plus isActive                                              | 200 Resource; 400, 401, 403, 404                                   |
| `DELETE /v1/studios/:id/resources/:resourceId`         | Soft-delete resource            | Studio manager |                                                                        | 204; 401, 403, 404, 422 if future bookings use it                  |
| `GET /v1/studios/:id/schedule`                         | Studio schedule                 | Studio member  | Required from/to, maximum 62 days; optional resourceId, photographerId | 200 ScheduleEntry[], unpaginated; 400, 401, 403, 404               |
| `POST /v1/studios/:id/schedule/blocks`                 | Block maintenance/time off      | Studio manager | Required start/end and exactly one resourceId/photographerId; title    | 201 ScheduleEntry; 400, 401, 403, 404, 409 CONFLICT / slot_overlap |
| `DELETE /v1/studios/:id/schedule/blocks/:entryId`      | Hard-delete block               | Studio manager |                                                                        | 204; 401, 403, 404                                                 |
| `GET /v1/photographers/:id/availability`               | Busy intervals without details  | Public         | Required from/to, maximum 62 days                                      | 200 `{ "data": { "busy": [{ "start", "end" }] } }`; 400, 404       |
| `POST /v1/photographers/me/schedule/blocks`            | Personal schedule block **[?]** | photographer   | start, end, title                                                      | 201 ScheduleEntry; 400, 401, 403, 409 CONFLICT / slot_overlap      |
| `DELETE /v1/photographers/me/schedule/blocks/:entryId` | Hard-delete personal block      | photographer   |                                                                        | 204; 401, 403, 404                                                 |

**Overlap rule:** Same resourceId or photographerId with intersecting intervals conflicts. Check confirmation, reassignment with reservations, and rescheduling. Return 409 CONFLICT with details[].reason=slot_overlap and a user-facing explanation.

---

## 12. Booking and Shoot Brief

Reservations must match Booking.scheduledStart/End and current provider/assignee; each row reserves one photographer or resource. Cancellation releases reservations but retains booking times/resource snapshots. Conflicts roll back booking, schedule, snapshots, and events atomically.

### 12.1 Objects

**Booking**

| Field                        | Type                        | Notes                                                                                                                                                                            |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                           | uuid                        |                                                                                                                                                                                  |
| customer                     | UserSummary                 |                                                                                                                                                                                  |
| providerType                 | ProviderType                | photographer or studio                                                                                                                                                           |
| photographer                 | PhotographerSummary \| null | Present when `providerType = photographer`                                                                                                                                       |
| studio                       | StudioSummary \| null       | Present when `providerType = studio`                                                                                                                                             |
| assignedPhotographer         | PhotographerSummary \| null | Studio manager assigns; required in confirmed/in_progress/proofing/delivered/completed. Personal bookings always null; cancellations retain prior assignee                       |
| service                      | object                      | Snapshot { id, name, price, durationMinutes, photoCount, retouchedCount }; id may become null after source hard deletion; counts are nonnegative integers or null if unspecified |
| addOns                       | object[]                    | Snapshot: `[{ id, name, price }]`                                                                                                                                                |
| totalPrice                   | integer                     | service.price plus add-on snapshots; backend fixes at creation. brief.budget does not change price; no payment processing                                                        |
| status                       | BookingStatus               |                                                                                                                                                                                  |
| scheduledStart, scheduledEnd | datetime \| null            | Both null or valid end>start; required confirmed through completed and retained after cancellation if set                                                                        |
| resourceIds                  | uuid[]                      | Latest committed resource snapshot IDs; returned after cancellation without implying active reservations                                                                         |
| resources                    | BookingResourceSnapshot[]   | Name/type snapshots; [] for personal bookings or no resources                                                                                                                    |
| currentBriefVersion          | integer                     | Latest brief version number                                                                                                                                                      |
| agreedBriefVersion           | integer \| null             | Effective mutually approved version; retain while negotiating a replacement; null if none                                                                                        |
| shootRoomId                  | uuid \| null                | Available from khi `confirmed`                                                                                                                                                   |
| statusReason                 | string \| null              | Rejection/cancellation reason                                                                                                                                                    |
| createdAt, updatedAt         | datetime                    |                                                                                                                                                                                  |

**BookingResourceSnapshot**

| Field      | Type         | Notes                                      |
| ---------- | ------------ | ------------------------------------------ |
| resourceId | uuid         | Original resource preserved by FK RESTRICT |
| name       | string       | Name snapshot at confirmation/rescheduling |
| type       | ResourceType | Type snapshot at confirmation/rescheduling |

resources/resourceIds have identical ID sets from booking_resources. Allowed rescheduling replaces the latest committed configuration; cancellation/completion retains it. Renaming/soft-deleting resources does not rewrite snapshots. No complete resource-change log in MVP.

**BookingAssignmentEvent** (read-only)

| Field            | Type                        | Notes                     |
| ---------------- | --------------------------- | ------------------------- |
| id               | uuid                        | UUIDv7                    |
| bookingId        | uuid                        | Booking studio            |
| fromPhotographer | PhotographerSummary \| null | Null for first assignment |
| toPhotographer   | PhotographerSummary         | New assignee              |
| actor            | UserSummary                 | Acting manager            |
| createdAt        | datetime                    |                           |

Record first assignment and replacements, including assignments during confirmation, in the booking/schedule transaction. Repeating the current assignee is a no-op without an event.

**BriefVersion** (immutable content; edits create a new version)

| Field              | Type         | Notes                                                                   |
| ------------------ | ------------ | ----------------------------------------------------------------------- |
| version            | integer      | Starts at 1                                                             |
| createdBy          | UserSummary  |                                                                         |
| content            | BriefContent | references contains stable Storage paths                                |
| referenceUrls      | string[]     | Read response only; signed URLs in the same order as content.references |
| approvedByCustomer | boolean      |                                                                         |
| approvedByProvider | boolean      |                                                                         |
| createdAt          | datetime     |                                                                         |

**BriefContent** (Shoot Brief)

| Field                        | Type             | Required | Notes                                                                                     |
| ---------------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------- |
| genre                        | Genre            | yes      |                                                                                           |
| concept                      | string           | yes      | 1–2000 characters describing concept/mood/requirements                                    |
| locationType                 | LocationType     | yes      |                                                                                           |
| locationNote                 | string \| null   | no       | Specific location, <=300 characters                                                       |
| preferredStart, preferredEnd | datetime \| null | no       | Customer's preferred interval                                                             |
| peopleCount                  | integer \| null  | no       | ≥ 1                                                                                       |
| references                   | string[]         | no       | At most 10 private brief-references storagePaths; backend signs in matching order on read |
| revisionRounds               | integer          | no       | Additional rounds after first; integer >=0, default 1                                     |
| photoCount                   | integer \| null  | no       | Desired images                                                                            |
| retouchedCount               | integer \| null  | no       | Desired retouched images                                                                  |
| budget                       | integer \| null  | no       | VND                                                                                       |
| notes                        | string \| null   | no       | At most 1000 characters                                                                   |

**BookingStatusEvent**

| Field      | Type                | Notes                                             |
| ---------- | ------------------- | ------------------------------------------------- |
| id         | uuid                |                                                   |
| bookingId  | uuid                |                                                   |
| fromStatus | BookingStatus       | Previous state; events represent transitions only |
| toStatus   | BookingStatus       | New state                                         |
| actor      | UserSummary \| null | Null for system action                            |
| reason     | string \| null      | Optional reason                                   |
| createdAt  | datetime            | Event timestamp                                   |

For every transition, lock/recheck booking, update status, record BookingStatusEvent, and apply schedule/snapshot/room/gallery/delivery effects in one transaction. Confirmation also records a new assignment event if applicable. Any failure rolls back all changes. Events may generate system messages without altering event history.

### 12.2 Endpoint

| Endpoint                                                | Purpose / screen                                                            | Access                                         | Request                                                                                                                                 | Response / errors                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/bookings`                                     | Request booking and brief v1, pending                                       | Authenticated                                  | Example below                                                                                                                           | 201 Booking; 400, 401, 404 missing/inactive service/provider, 422 self-booking/provider mismatch/hidden provider                                  |
| `GET /v1/bookings`                                      | My bookings                                                                 | Authenticated                                  | as=customer (default) or provider; status, studioId for provider manager view, page, pageSize                                           | 200 Booking[] + meta; 400, 401, 403                                                                                                               |
| `GET /v1/bookings/:id`                                  | Detail                                                                      | Participant, including relevant studio manager |                                                                                                                                         | 200 Booking; 401, 404                                                                                                                             |
| `GET /v1/bookings/:id/events`                           | Status history                                                              | Participant                                    |                                                                                                                                         | 200 BookingStatusEvent[], chronological; 401, 404                                                                                                 |
| `POST /v1/bookings/:id/transitions`                     | Transition, table 12.4                                                      | Per transition                                 | `{ "to": BookingStatus, ... }`                                                                                                          | 200 Booking; 400, 401, 403, 404, 409 CONFLICT / slot_overlap, 422                                                                                 |
| `PATCH /v1/bookings/:id/assignment`                     | Studio assignment/reassignment                                              | Relevant studio manager                        | Required non-null assignedPhotographerId, current member                                                                                | 200 Booking; 400, 401, 403, 404, 409 slot_overlap, 422 for non-studio/non-member or states outside pending/confirmed/in_progress                  |
| `GET /v1/bookings/:id/assignment-events`                | Assignment history                                                          | Current participant                            |                                                                                                                                         | 200 BookingAssignmentEvent[], ascending (createdAt,id); 401, 404                                                                                  |
| `PATCH /v1/bookings/:id/schedule`                       | Change committed time/resources                                             | Personal provider / studio manager             | Required scheduledStart/End, end>start; optional resourceIds (omitted preserves, [] clears; personal bookings cannot reserve resources) | 200 Booking; 400, 401, 403, 404, 409 slot_overlap, 422 if not confirmed, inactive/wrong-studio resources, or personal resources                   |
| `GET /v1/bookings/:id/brief`                            | All brief versions                                                          | Participant                                    |                                                                                                                                         | 200 `{ "data": { "versions": BriefVersion[], "currentVersion": integer, "agreedVersion": integer \| null } }` with signed referenceUrls; 401, 404 |
| `POST /v1/bookings/:id/brief/versions`                  | Propose version; creator's side approves automatically, other side does not | Participant                                    | BriefContent                                                                                                                            | 201 BriefVersion; 400, 401, 403, 404, 422 invalid booking state                                                                                   |
| `POST /v1/bookings/:id/brief/versions/:version/approve` | Approve latest version; update agreed pointer when both approve             | Unapproved participant side                    |                                                                                                                                         | 200 BriefVersion; 401, 403, 404, 409 already approved, 422 not latest                                                                             |

GET /v1/bookings?as=provider returns personal provider bookings and assigned studio bookings. With studioId, managers see all that studio's bookings; non-managers receive 403. Other members do not see unrelated bookings.

Only managers assign. Pending does not reserve time. At confirmed/in_progress, transfer the photographer reservation while retaining time/resources and recording the event atomically; conflicts return 409 without changing prior data. Personal bookings have no assignment. Access follows current assignee; old assignment access is revoked, new assignee sees history, independent customer/manager access remains.

Reschedule only confirmed: lock/recheck booking, times, and active same-studio resources; atomically update booking, all reservations, and resource snapshots. Preserve assignee; resourceIds must be unique. Never rewrite immutable preferredStart/End in briefs. Actual time comes from booking; no reschedule endpoint from in_progress onward.

Create/approve briefs only in pending/confirmed/in_progress, otherwise 422. Keep the agreed version effective until the newest replacement is approved by both sides. Lock/recheck booking/version during create/approve; approval records only caller's side. Changing preferred times does not change reservations.

Fix service/add-on snapshots and totalPrice atomically with booking/brief v1 creation; later service/budget changes do not affect them. Customer/provider/assignee FKs use ON DELETE RESTRICT, including finished bookings. Deleting Auth users cannot cascade-delete booking history.

Upload private brief-references at {userId}/{uuid}.webp before booking. brief.references contains storagePaths, not URLs. Backend verifies caller ownership and existence; only participants receive signed URLs.

**Example `POST /v1/bookings`:**

```json
{
  "providerType": "photographer",
  "photographerId": "019e2310-0000-7000-8000-000000000004",
  "studioId": null,
  "serviceId": "019e2310-0000-7000-8000-000000000005",
  "addOnIds": [],
  "brief": {
    "genre": "portrait",
    "concept": "Cool-tone portraits with morning window light.",
    "locationType": "studio",
    "locationNote": null,
    "preferredStart": "2026-11-02T02:00:00Z",
    "preferredEnd": "2026-11-02T04:00:00Z",
    "peopleCount": 1,
    "references": [],
    "photoCount": 20,
    "retouchedCount": 10,
    "budget": 2000000,
    "notes": null
  }
}
```

For photographer providers require photographerId, null studioId/assignedPhotographerId, and no resources at confirmation. For studio providers require studioId and null photographerId; resources must belong to that studio. Personal resource requests return 422 personal_booking_resources.

### 12.3 Example `POST /v1/bookings/:id/transitions`

```json
{
  "to": "confirmed",
  "scheduledStart": "2026-11-02T02:00:00Z",
  "scheduledEnd": "2026-11-02T04:00:00Z",
  "resourceIds": [],
  "assignedPhotographerId": null
}
```

### 12.4 Booking state transitions

Unlisted transitions return 422 UNPROCESSABLE.

| From        | To          | Actor                              | Body                                                                                                       | Preconditions and effects                                                                                                                                        |
| ----------- | ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pending     | confirmed   | Personal provider / studio manager | scheduledStart/End; studio-only optional resourceIds; assignedPhotographerId for unassigned studio booking | Check conflicts (409), current studio membership, manager-only assignment, studio-owned resources. Atomically create reservations, snapshots, Shoot Room, events |
| `pending`   | `rejected`  | Provider side                      | `reason`                                                                                                   |                                                                                                                                                                  |
| pending     | cancelled   | Customer                           | Optional reason                                                                                            |                                                                                                                                                                  |
| confirmed   | cancelled   | Customer or provider side          | reason                                                                                                     | Release schedule, close room, retain times/assignee/snapshots; cancellation policy **[?]**                                                                       |
| confirmed   | in_progress | Provider side                      |                                                                                                            | Require agreedBriefVersion or 422                                                                                                                                |
| in_progress | proofing    | Provider side                      |                                                                                                            | Draft gallery with >=1 image becomes open_for_selection (14)                                                                                                     |
| in_progress | cancelled   | Provider side                      | reason                                                                                                     | Release schedule, close room, retain times/assignee/snapshots                                                                                                    |
| proofing    | delivered   | Provider side                      |                                                                                                            | Require selection_submitted gallery and >=1 delivery file; finalize gallery, mark delivery delivered                                                             |
| delivered   | completed   | Customer                           |                                                                                                            | Enable review; automatic completion timeout unresolved **[?]**                                                                                                   |

Rejected/cancelled/completed are terminal. Cancelled/completed Shoot Rooms become read-only.

No cancellation from proofing onward in MVP, intentionally after selection/delivery. Non-response during proofing/delivered and auto-completion policy remain decision 20 #9.

---

## 13. Shoot Room

Reassignment revokes former assignment access and grants history to the new photographer; customer/manager rights remain independent. API, Storage RLS, and Realtime must recheck current rights rather than retain stale subscription access. Already downloaded data cannot be recalled.

Backend creates Shoot Room at confirmation; Booking.shootRoomId identifies it. Participants: customer, personal/assigned photographer, relevant studio managers. Other studio members are excluded provisionally **[?]**, decision 20 #11.

**ShootRoom**

| Field        | Type            | Notes                                            |
| ------------ | --------------- | ------------------------------------------------ |
| id           | uuid            |                                                  |
| bookingId    | uuid            |                                                  |
| status       | ShootRoomStatus | closed means read-only                           |
| participants | object[]        | `[{ "user": UserSummary, "side": BookingSide }]` |
| createdAt    | datetime        |                                                  |

**Message**

| Field       | Type                | Notes                                                                   |
| ----------- | ------------------- | ----------------------------------------------------------------------- |
| id          | uuid                |                                                                         |
| roomId      | uuid                |                                                                         |
| sender      | UserSummary \| null | Null for system messages                                                |
| type        | MessageType         |                                                                         |
| body        | string \| null      | At most 2000 characters                                                 |
| attachments | object[]            | `[{ "url", "thumbnailUrl", "width", "height" }]`, at most 5 per message |
| isHidden    | boolean             | Hidden messages return body:null and attachments:[]                     |
| createdAt   | datetime            |                                                                         |

**Decision** (decision log)

| Field                  | Type                | Notes                               |
| ---------------------- | ------------------- | ----------------------------------- |
| id                     | uuid                |                                     |
| roomId                 | uuid                |                                     |
| title                  | string              | 1–120 characters                    |
| content                | string              | 1–1000 characters                   |
| status                 | DecisionStatus      |                                     |
| proposedBy             | UserSummary         |                                     |
| respondedBy            | UserSummary \| null | Responding user from the other side |
| createdAt, respondedAt | datetime \| null    |                                     |

**Milestone**

| Field     | Type             | Notes            |
| --------- | ---------------- | ---------------- |
| id        | uuid             |                  |
| roomId    | uuid             |                  |
| title     | string           | 1–120 characters |
| dueAt     | datetime \| null | Deadline         |
| status    | MilestoneStatus  |                  |
| doneAt    | datetime \| null |                  |
| createdBy | UserSummary      |                  |

| Endpoint                                                 | Purpose / screen               | Access                    | Request                                                                                                                         | Response / errors                                       |
| -------------------------------------------------------- | ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `GET /v1/shoot-rooms/:id`                                | Room details                   | Participant               |                                                                                                                                 | 200 ShootRoom; 401, 404                                 |
| `GET /v1/shoot-rooms/:id/messages`                       | Cursor history                 | Participant               | limit, before                                                                                                                   | 200 Message[] + cursor meta (2.2); 401, 404             |
| `POST /v1/shoot-rooms/:id/messages`                      | Send; receive through Realtime | Participant               | type=text/image, body and/or attachments [{ storagePath, width, height }] in room-files; upload main/thumbnail pairs for images | 201 Message; 400, 401, 404, 422 closed                  |
| `GET /v1/shoot-rooms/:id/decisions`                      | Decision log                   | Participant               | status, page, pageSize                                                                                                          | 200 Decision[] + meta; 401, 404                         |
| `POST /v1/shoot-rooms/:id/decisions`                     | Propose decision               | Participant               | title, content                                                                                                                  | 201 Decision; 400, 401, 404, 422                        |
| `POST /v1/shoot-rooms/:id/decisions/:decisionId/respond` | Respond to other side          | Opposite-side participant | `{ "response": "agreed" \| "rejected" }`                                                                                        | 200 Decision; 400, 401, 403, 404, 422 already responded |
| `GET /v1/shoot-rooms/:id/milestones`                     | Milestones / timeline          | Participant               | Unpaginated; dueAt order                                                                                                        | 200 Milestone[]; 401, 404                               |
| `POST /v1/shoot-rooms/:id/milestones`                    | Add milestone                  | Participant               | Required title; dueAt                                                                                                           | 201 Milestone; 400, 401, 404, 422                       |
| `PATCH /v1/shoot-rooms/:id/milestones/:milestoneId`      | Edit/mark done                 | Participant               | title, dueAt, status                                                                                                            | 200 Milestone; 400, 401, 404, 422                       |
| `DELETE /v1/shoot-rooms/:id/milestones/:milestoneId`     | Hard-delete milestone          | Creator                   |                                                                                                                                 | 204; 401, 403, 404, 422                                 |

**Message example, also the Realtime payload:**

```json
{
  "data": {
    "id": "019e2310-0000-7000-8000-000000000008",
    "roomId": "019e2310-0000-7000-8000-000000000002",
    "sender": {
      "id": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11",
      "userName": "nguyen_an",
      "displayName": "An Nguyen",
      "avatarUrl": null
    },
    "type": "text",
    "body": "Could we move the session to 9 AM?",
    "attachments": [],
    "isHidden": false,
    "createdAt": "2026-10-20T08:15:00Z"
  }
}
```

All writes to closed rooms return 422. History preserves a hidden message's position but returns isHidden:true, body:null, attachments:[]; ordinary participants never receive the original content.

---

## 14. Photo selection (proofing)

**Gallery**

| Field                | Type             | Notes                                                                |
| -------------------- | ---------------- | -------------------------------------------------------------------- |
| id                   | uuid             |                                                                      |
| bookingId            | uuid             | One gallery per booking                                              |
| status               | GalleryStatus    | `draft` → `open_for_selection` → `selection_submitted` → `finalized` |
| selectionLimit       | integer \| null  | Maximum selected images; null is unlimited                           |
| imageCount           | integer          |                                                                      |
| selectedCount        | integer          |                                                                      |
| submittedAt          | datetime \| null |                                                                      |
| round                | integer          | Starts at 1; increments per accepted selection/reopen                |
| createdAt, updatedAt | datetime         |                                                                      |

**GalleryImage** (preview)

| Field         | Type    | Notes                      |
| ------------- | ------- | -------------------------- |
| id            | uuid    |                            |
| galleryId     | uuid    |                            |
| previewUrl    | string  | Expiring signed URL        |
| thumbnailUrl  | string  | Expiring signed URL        |
| width, height | integer |                            |
| sortOrder     | integer |                            |
| isSelected    | boolean | Current customer selection |
| noteCount     | integer | Image note count           |

**ImageNote** (image feedback)

| Field          | Type           | Notes                                                     |
| -------------- | -------------- | --------------------------------------------------------- |
| id             | uuid           |                                                           |
| galleryImageId | uuid           |                                                           |
| author         | UserSummary    |                                                           |
| body           | string         | 1–500 characters                                          |
| x, y           | number \| null | Normalized pin position 0–1; both null for a general note |
| createdAt      | datetime       |                                                           |

| Endpoint                                                 | Purpose / screen                              | Access           | Request                                                                                                    | Response / errors                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/bookings/:id/gallery`                          | Create draft during in_progress               | Provider side    | Optional selectionLimit                                                                                    | 201 Gallery; 401, 403, 404, 409 exists, 422 wrong booking state                                                        |
| `GET /v1/bookings/:id/gallery`                           | Read gallery                                  | Participant      |                                                                                                            | 200 Gallery; 401, 404 while draft for customer                                                                         |
| `PATCH /v1/galleries/:id`                                | Change selection limit                        | Provider side    | selectionLimit                                                                                             | 200 Gallery; 400, 401, 403, 404, 422                                                                                   |
| `GET /v1/galleries/:id/images`                           | Preview list                                  | Participant      | page, pageSize (maximum 100)                                                                               | 200 GalleryImage[] + meta; 401, 404                                                                                    |
| `POST /v1/galleries/:id/images`                          | Record uploaded preview in gallery-previews   | Provider side    | Main storagePath, width, height; backend derives/checks thumbnail and actual metadata, dimensions 1–1280px | 201 GalleryImage; 400, 401, 403, 404, 422                                                                              |
| `DELETE /v1/galleries/:id/images/:imageId`               | Hard-delete preview record and main/thumbnail | Provider side    |                                                                                                            | 204; 401, 403, 404, 422 unless draft                                                                                   |
| `PUT /v1/galleries/:id/selection`                        | Replace current selection                     | Booking customer | `{ "imageIds": uuid[] }`                                                                                   | 200 `{ "data": { "selectedCount": integer } }`; 400, 401, 403, 404, 422 above selectionLimit or not open_for_selection |
| `POST /v1/galleries/:id/selection/submit`                | Submit and lock selection                     | Booking customer |                                                                                                            | 200 Gallery, selection_submitted; 401, 403, 404, 422                                                                   |
| `POST /v1/galleries/:id/selection/reopen`                | Reopen within revision allowance              | Provider side    |                                                                                                            | 200 Gallery, open_for_selection; 401, 403, 404, 422 exhausted revisions                                                |
| `GET /v1/galleries/:id/images/:imageId/notes`            | Image notes                                   | Participant      | Unpaginated                                                                                                | 200 ImageNote[]; 401, 404                                                                                              |
| `POST /v1/galleries/:id/images/:imageId/notes`           | Add note                                      | Participant      | Required body; optional x,y                                                                                | 201 ImageNote; 400, 401, 403, 404, 422 finalized                                                                       |
| `DELETE /v1/galleries/:id/images/:imageId/notes/:noteId` | Hard-delete note                              | Author           |                                                                                                            | 204; 401, 403, 404                                                                                                     |

**Notes:** System finalizes gallery when booking becomes delivered; no direct endpoint. Round starts at 1 and increments only on accepted reopen, not submit. Mutually agreed brief revisionRounds (default 1) specifies additional reopenings after the first round. Return 422 when exhausted.

---

## 15. Delivery

**Delivery**

| Field       | Type             | Notes                              |
| ----------- | ---------------- | ---------------------------------- |
| id          | uuid             |                                    |
| bookingId   | uuid             | One delivery per booking           |
| status      | DeliveryStatus   |                                    |
| note        | string \| null   | Provider note, <=1000 characters   |
| items       | DeliveryItem[]   |                                    |
| deliveredAt | datetime \| null | Set when booking becomes delivered |
| expiresAt   | datetime \| null | Download expiry **[?]**            |

**DeliveryItem**

| Field          | Type             | Notes                        |
| -------------- | ---------------- | ---------------------------- |
| id             | uuid             |                              |
| fileName       | string           |                              |
| mimeType       | DeliveryMimeType | JPEG, PNG, WebP              |
| sizeBytes      | integer          |                              |
| galleryImageId | uuid \| null     | Corresponding preview if any |
| createdAt      | datetime         |                              |

| Endpoint                                               | Purpose / screen                    | Access                                     | Request                                                                      | Response / errors                                                                |
| ------------------------------------------------------ | ----------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /v1/bookings/:id/delivery`                       | Create preparing delivery           | Provider side                              | Optional note                                                                | 201 Delivery; 401, 403, 404, 409 exists, 422 booking not proofing                |
| `GET /v1/bookings/:id/delivery`                        | Read delivery                       | Provider anytime; customer after delivered |                                                                              | 200 Delivery; 401, 404                                                           |
| `POST /v1/bookings/:id/delivery/items`                 | Record uploaded deliveries file     | Provider side                              | Required storagePath, fileName, mimeType, sizeBytes; optional galleryImageId | 201 DeliveryItem; 400, 401, 403, 404, 422 not preparing / exceeds limits **[?]** |
| `DELETE /v1/bookings/:id/delivery/items/:itemId`       | Hard-delete record and Storage file | Provider side                              |                                                                              | 204; 401, 403, 404, 422 unless preparing                                         |
| `GET /v1/bookings/:id/delivery/items/:itemId/download` | Short-lived signed download URL     | Provider; customer after delivered         |                                                                              | 200 `{ "data": { "url": string, "expiresAt": datetime } }`; 401, 403, 404        |

**Notes:** No RAW storage. Delivery contains processed images; limits remain decision 20 #12.

---

## 16. Review

**Review**

| Field                | Type           | Notes                                                                                                                      |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| id                   | uuid           |                                                                                                                            |
| bookingId            | uuid           | At most one review over the booking's entire lifetime, including soft-deleted reviews; deletion does not allow replacement |
| reviewer             | UserSummary    |                                                                                                                            |
| targetType           | ProviderType   | photographer or studio                                                                                                     |
| photographerId       | uuid \| null   |                                                                                                                            |
| studioId             | uuid \| null   |                                                                                                                            |
| rating               | integer        | 1–5                                                                                                                        |
| comment              | string \| null | At most 1000 characters                                                                                                    |
| createdAt, updatedAt | datetime       |                                                                                                                            |

| Endpoint                            | Purpose / screen        | Access                | Request                  | Response / errors                                                                      |
| ----------------------------------- | ----------------------- | --------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `POST /v1/bookings/:id/reviews`     | Review booking provider | Customer              | Required rating; comment | 201 Review; 400, 401, 403, 404, 409 ever reviewed including deleted, 422 not completed |
| `GET /v1/photographers/:id/reviews` | Photographer reviews    | Public                | page, pageSize           | 200 Review[] + meta; 404                                                               |
| `GET /v1/studios/:id/reviews`       | Studio reviews          | Public                | page, pageSize           | 200 Review[] + meta; 404                                                               |
| `PATCH /v1/reviews/:id`             | Edit own review **[?]** | Author                | rating, comment          | 200 Review; 400, 401, 403, 404                                                         |
| `DELETE /v1/reviews/:id`            | Soft-delete review      | Author / system_admin |                          | 204; 401, 403, 404                                                                     |

**Notes:** Update provider ratingAvg/reviewCount when reviews change. Provider responses remain decision 20 #13 **[?]**.

---

## 17. Content reporting and administration [Should]

**Report**

| Field                 | Type                     | Notes                   |
| --------------------- | ------------------------ | ----------------------- |
| id                    | uuid                     |                         |
| reporter              | UserSummary              |                         |
| targetType            | ReportTargetType         |                         |
| targetId              | uuid                     |                         |
| reason                | ReportReason             |                         |
| detail                | string \| null           | At most 1000 characters |
| status                | ReportStatus             |                         |
| resolution            | ReportResolution \| null |                         |
| adminNote             | string \| null           | At most 1000 characters |
| createdAt, resolvedAt | datetime \| null         |                         |

| Endpoint                             | Purpose / screen                              | Access        | Request                                                | Response / errors                                                           |
| ------------------------------------ | --------------------------------------------- | ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `POST /v1/reports`                   | Report portfolio/image/review/message/profile | Authenticated | Required targetType, targetId, reason; optional detail | 201 Report; 400, 401, 404, 409 caller already has an open report for target |
| `GET /v1/admin/reports`              | Moderation queue                              | system_admin  | status, targetType, reason, page, pageSize             | 200 Report[] + meta; 401, 403                                               |
| `GET /v1/admin/reports/:id`          | Report and target detail                      | system_admin  |                                                        | 200 `{ "data": Report & { "target": object } }`; 401, 403, 404              |
| `POST /v1/admin/reports/:id/resolve` | Resolve report                                | system_admin  | Required resolution; optional adminNote                | 200 Report; 400, 401, 403, 404, 422 already resolved                        |

**Notes:** content_hidden sets portfolio status=hidden or isHidden on images/reviews/messages/photographers/studios. Hidden portfolios/images/reviews are excluded publicly. Hidden providers and their portfolios disappear from public lists/Explore/search and public GET returns 404; no new bookings, but existing bookings continue and owners can view themselves. Hidden messages retain position with isHidden:true, body:null, attachments:[]; only authorized moderation can view originals. Admin trust-inspection requirements remain open (20).

---

## 18. AI Search

Deferred design only: request/response sketches support future UI mocks. NLP/CV implementation is a later backlog phase; no AI execution is required by foundation.

### POST /v1/search

**Purpose:** Find photographers/studios using natural language and/or reference images plus filters.
**Screens:** Search bar/results.
**Access:** Text search public; image search may require authentication **[?]**. Rate-limited, 429.
**Request body:**

| Field            | Type              | Required                           | Notes                                                                                                                                                   |
| ---------------- | ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| query            | string \| null    | At least query or imageStoragePath | <=300 characters, Vietnamese or English                                                                                                                 |
| imageStoragePath | string \| null    |                                    | Uploaded search-uploads reference                                                                                                                       |
| filters          | object            | no                                 | genre, city, district, priceMax (integer, compared with provider's active-service priceFrom); explicit filters override parsed values with the same key |
| ignoreParsed     | SearchParsedKey[] | no                                 | Removed parsedQuery chips (genres, styles, city, district, priceMax); backend omits those parsed constraints                                            |
| page, pageSize   | integer           | no                                 | See 2.2                                                                                                                                                 |

```json
{
  "query": "cool-tone portraits with window light in Thu Duc under 2 million VND",
  "imageStoragePath": null,
  "filters": { "genre": "portrait" },
  "ignoreParsed": [],
  "page": 1,
  "pageSize": 20
}
```

**Response 200:**

```json
{
  "data": [
    {
      "provider": {
        "type": "photographer",
        "id": "019e2310-0000-7000-8000-000000000004",
        "displayName": "An Studio",
        "avatarUrl": null
      },
      "score": 0.87,
      "matchedImages": [
        {
          "imageId": "019e2310-0000-7000-8000-000000000003",
          "portfolioId": "019e2310-0000-7000-8000-000000000007",
          "thumbnailUrl": "https://.../img1_thumb.webp"
        }
      ],
      "reasons": ["Genre: portrait", "Style: cool tones", "Area: Thu Duc"]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 },
  "parsedQuery": {
    "genres": ["portrait"],
    "styles": ["cool tones", "window light"],
    "city": null,
    "district": "Thu Duc",
    "priceMax": 2000000
  }
}
```

**Errors:** 400, 401 unauthenticated image search, 422 missing image, 429, 503 unavailable AI service.
**Notes:**

- filters.genre: Genre; parsedQuery.genres: Genre[]; styles: string[]; city/district: string|null; priceMax: integer|null. Query/styles/reasons are natural language; do not force a style enum before taxonomy is decided. provider.type uses ProviderType.
- Backend/AI validate classification enums consistently (Zod/Pydantic). Invalid LLM enum output cannot be persisted or returned as valid; never invent enums from model strings.
- parsedQuery represents interpreted intent as removable chips; removing sends ignoreParsed keys, editing overrides via filters.
- reasons explains matches in user-facing text.
- Results group by provider with matched images; studio portfolio images belong to the studio. Ungrouped image-level search remains **[?]**.
- Exclude hidden providers.
- score is 0–1, for ordering/indicative display.
- filters.priceMax compares provider priceFrom, the minimum active/non-deleted service price, not customer-entered booking budget.

---

## 19. Studio dashboard and timeline [Should, outline]

### GET /v1/studios/:id/dashboard

**Purpose:** Basic studio business metrics.
**Screens:** Dashboard studio.
**Access:** Studio manager.
**Query:** Required from/to, maximum 366 days.
**Response 200:**

```json
{
  "data": {
    "period": { "from": "2026-10-01", "to": "2026-10-31" },
    "bookingsByStatus": { "pending": 2, "confirmed": 3, "completed": 8, "cancelled": 1 },
    "estimatedRevenue": 24500000,
    "ratingAvg": 4.7,
    "topServices": [
      {
        "serviceId": "019e2310-0000-7000-8000-000000000005",
        "name": "Two-hour portrait session",
        "bookingCount": 5
      }
    ],
    "bookingsPerDay": [{ "date": "2026-10-03", "count": 2 }]
  }
}
```

**Errors:** 400, 401, 403, 404.
**Notes:** estimatedRevenue sums completed booking totalPrice in the period; it is not actual payment revenue because MVP has no payments.

### GET /v1/me/timeline

**Purpose:** Upcoming shoots/milestones across the caller's participating bookings.
**Screens:** Timeline/deadline.
**Access:** Authenticated.
**Query:** Required from/to, maximum 62 days.
**Response 200:** `{ "data": [{ "type": TimelineItemType, "bookingId": uuid, "shootRoomId": uuid | null, "title": string, "at": datetime, "status": BookingStatus | MilestoneStatus }] }`
**Errors:** 400, 401.

---

## 20. Open decisions

Resolved decisions remain in their relevant sections. Preserve numbering below for cross-references; unresolved items need owner decisions.

Question #1 is compared in [Proposed ADR 0003](../adr/0003-auth-profile-initialization.md) and the [auth packet](../features/auth/packet.md). It remains unresolved; neither document accepts a new endpoint or changes this draft's initialization behavior.

| #   | Decision                                                                                                                  | Owners                   |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | DB-trigger versus backend profile initialization; required username, duplicate handling, initialization errors            | Ly, Khai                 |
| 2   | Free-text styles or standard tags; who assigns image tags and which TagKind groups are needed                             | Product owner, Quynh Anh |
| 3   | Portfolio image quota and total per-account storage                                                                       | Team                     |
| 4   | Free-text crew credit in portfolios                                                                                       | Product owner            |
| 5   | Trust metrics beyond ratingAvg/reviewCount, e.g. booking counts/on-time rate                                              | Product owner            |
| 6   | Mandatory ai_generated labeling in web                                                                                    | Product owner, Khoa      |
| 7   | Resolved: UUIDv7 message IDs with (created_at,id) cursors (2.2)                                                           | —                        |
| 8   | Resolved: manager assignment, no leaving with active assignments, assignment history (9,12)                               | —                        |
| 9   | Cancellation deadlines/fees, completion timeout, proofing/delivered non-response; no cancellation from proofing currently | Product owner, Khai      |
| 10  | Resolved: brief create/approve only pending/confirmed/in_progress; prior agreement remains until mutual replacement (12)  | —                        |
| 11  | Shoot Room access: booking participants only or all studio members                                                        | Ly, Khai                 |
| 12  | File/booking size quotas and delivery/room retention/expiry                                                               | Team                     |
| 13  | Review editing/provider replies and separate assigned-photographer reviews for studio bookings                            | Product owner            |
| 14  | Personal photographer schedule blocks in MVP                                                                              | Product owner, Khoa      |
| 15  | Admin trust-inspection endpoints beyond moderation                                                                        | Product owner, Quynh Anh |
| 16  | Deferred AI image-search authentication, image-level results, search-uploads retention                                    | Quynh Anh, Khai          |
| 17  | Push/email/in-app invitation/status notifications; currently outside MVP                                                  | Team                     |
| 18  | gallery_selections history per round or current selection only                                                            | Product owner, Khoa      |

---

## 21. Follow-up after v1 review

- [ ] Khai implements scoped shared Zod schemas and Swagger with each feature.
- [ ] Khoa builds mocks from contract examples for the next feature group.
- [ ] Ly maps fields/enums/transitions to DB/RLS and reports gaps.
- [ ] Nguyen splits resource docs if needed and uses API labels for contract changes.
- [ ] Add FE screen identifiers when wireframes exist.
- [ ] Contract changes go through API-labeled PRs and team coordination:
  - Additive optional fields/endpoints: one reviewer.
  - Breaking rename/type/removal/access/state changes: Khai and Khoa, plus Ly for schema.
- [ ] Refine Should/later-phase groups additively when their implementation begins.

---

## Change history

| Version | Date       | Changes                                                                                                                                                                                           | Author          |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| v0      | 2026-10-12 | Initial Sprint 1 draft                                                                                                                                                                            | Original author |
| v0.2    | 2026-10-12 | Full MVP outline, Storage/Realtime/access/error 503, ratings/counts, hidden portfolios                                                                                                            | Original author |
| v0.3    | 2026-10-14 | Deletion categories/30-day cleanup, details reasons, upload pairs, display specialties, studio portfolios, revisions/private references/events/publication, hidden content, derived service price | Design review   |
| v0.4    | 2026-10-14 | ProviderSummary/search grouping/ignoreParsed, hidden providers, provider booking visibility, no proofing cancellation, references/format                                                          | Design review   |
| v0.5    | 2026-10-20 | Client/photographer signup, multi-studio membership, unique username/profile route, UUIDv7, synchronized classification enums and AI validation                                                   | Design review   |

| v0.6 | 2026-10-20 | Assignment/time/membership invariants, atomic scheduling/conflicts, effective agreed briefs, count/resource snapshots, assignment access/events, FK RESTRICT | Design review |

| v0.7 | 2026-10-20 | Studio-only resources, lifetime review uniqueness, UserSummary username examples, image dimensions/limits | Contract/ERD review |
| v0.8 | 2026-10-21 | English documentation; distinguish implemented health from designs; defer AI implementation | SETUP-001 |
