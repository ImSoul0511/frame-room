# FrameRoom MVP API

Status: implemented under MVP-001, pending team review. This is the implementation
contract; [draft v0](contract_v0.md) remains historical design context. The running
API exposes `GET /v1/openapi.json` with route request schemas. Shared Zod contracts
are in `packages/shared/src/business.ts` and `locale.ts`.

## Common behavior

- Business responses use `{ data }`; search additionally returns `parsedQuery`,
  `effectiveFilters`, and `meta`. Health retains its original unenveloped response.
- Errors retain `{ error: { code, message, details: [{ reason }] } }`. Clients localize
  machine-readable reasons; backend English messages are not UI copy.
- Protected requests require a verified Supabase bearer identity. Browser metadata
  never grants roles. The server verifies the identity with Supabase Auth.
- `Accept-Language: en` or `vi` controls AI replies, briefs, proposals, culling, and
  search explanations. Missing/unsupported language defaults to English. Existing
  user content is not automatically translated; retrieval descriptions stay English.
- IDs are UUIDs. Business IDs use UUIDv7; profile IDs preserve Supabase Auth IDs.
- AI job submissions accept a UUID `Idempotency-Key`; retries with that key return
  the existing own-project job. Reusing it across users/projects is a conflict.
- Scheduling and actions carry the expected booking/project version. Conflict
  responses never silently overwrite the other participant's changes.

## Routes and boundaries

| Group         | Implemented interface                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Profiles      | GET/POST/PATCH `/v1/me`; GET `/v1/me/studios`, `/v1/me/invitations`                        |
| Photographers | GET lists/detail/me; POST/PATCH `/v1/photographers/me`; PATCH `/v1/photographers/me/cover` |
| Discovery     | GET `/v1/explore`, `/v1/photographers`, `/v1/studios`, provider detail, `/v1/tags`         |

| Studios | POST/PATCH studios; team, membership roles/departure, invitations and responses, resources, dashboard |
| Catalog | Personal/studio portfolios and services, image registration and tags, service add-ons, soft deletion |
| Projects | GET/POST `/v1/creative-projects`, GET/PATCH/DELETE detail; references, artifacts, assistant history, actions, jobs |
| Assistant | POST project `/assistant` for brief/action; POST project `/chat` for AI SDK UI streaming |
| AI jobs | POST project `/ai-jobs` returns 202; GET project jobs or `/v1/ai-jobs/:id` |
| AI actions | POST `/v1/ai-actions/:id/confirm` or `/reject`; caller, state, expiry, and versions checked again |
| Booking | POST booking-requests; booking detail/workspace; versioned transitions, assignment, reassignment and cancellation |
| Agreement | POST booking brief versions; approve the latest version or record a revision request |
| Conversations | GET/POST conversations; cursor-paginated message history; idempotent send; authenticated attachment retrieval |
| Shoot Room | Booking-scoped messages, milestones, decisions and protected attachments during collaboration |
| Proofing | Watermarked gallery previews, round-specific photo feedback, quota, revision requests and final-file gate |
| Completion | POST booking deliveries and reviews; 168-hour automatic completion; administrator dispute holds |
| Schedule | GET `/v1/me/timeline`, `/v1/me/schedule`; POST/DELETE own/resource blocks |
| Moderation | POST reports on public content; audited report decisions and review reassessment |
| Media | POST `/v1/uploads?bucket=...&scopeId=...` with one multipart image; API validates, normalizes and writes Storage |

Photographer covers require migration `20261125000100_photographer_cover.sql`.
Upload a JPEG, PNG or WebP image with `POST /v1/uploads?bucket=profile-covers`,
then send its returned `storagePath` as `coverPath` to
`PATCH /v1/photographers/me/cover`. The server verifies the caller owns the
uploaded image and a photographer profile. Public photographer detail returns
`coverPath`; the UI falls back to a published portfolio cover when it is null.
The bucket is public, so uploaded covers are publicly accessible.
Photographer detail also exposes the account's public `avatarPath`; clients use
the account avatar or show initials when no image is available.

Project deletion requires migration `20261125000200_soft_delete_projects.sql`.
Only the owner may delete a project. Projects linked to a booking or with a
queued or running AI job are rejected with a conflict. Deletion hides the project
and its associated content from project access; records and stored files remain.

`GET /v1/bookings/:id/workspace` aggregates the authorized booking, project, room,
briefs, messages, decisions, milestones, gallery, selection, delivery, and review.
The workspace includes pending cancellation, gallery quota, revision limit and
feedback for authorized parties. Gallery, brief and delivery URLs are signed for
five minutes. Message attachments use authenticated Storage reads with current
membership and booking authorization.

Unlike the historical draft's proposed direct browser uploads, this implementation
uploads through the API so Sharp can verify bytes, correct orientation, normalize
WebP, and create paired thumbnails. Storage path ownership is rechecked when the
file is registered. JPEG, PNG and WebP images may have up to 40 million decoded
pixels. The input limit is 50 MiB for portfolio images, brief references and Shoot
Room or Conversation images, and 20 MiB for other uploads, including final deliveries. Normalized
previews are at most 1280 px and thumbnails at most 320 px, with a 2 MiB limit
per stored object. No RAW files or arbitrary remote image URLs.

### Photographer detail by display name

`GET /v1/photographers/:id` accepts a photographer UUID or a URL-encoded display
name. `GET /v1/photographers/by-name?displayName=...` explicitly selects name
lookup and also supports names such as `me`, UUID-shaped names and names that
are long when URL-encoded. The lookup trims outer whitespace and matches case
and accents exactly against the public photographer profile.

Both forms return the same provider detail. A missing public name returns 404.
Multiple visible photographers with the same name return
`409 photographer_display_name_ambiguous`. Use a photographer UUID to select
one of those profiles.

### Booking completion

Moving a booking to `delivered` starts a 168-hour deadline using database time.
The worker checks for due bookings every 30 seconds, including without an AI key.
Automatic completion closes the Shoot Room and records a system audit event.
Delivery access is preserved, and the client may submit one review after completion.
The system does not submit a review.

Participants can read the deadline or paused time in the authorized booking
response. System administrators can list managed bookings with
`GET /v1/admin/booking-completions?page=1` and place or release a hold with
`PATCH /v1/admin/bookings/:id/completion-hold` using `{hold, version, reason}`.
A hold pauses automatic completion and retains the remaining time. Releasing it
sets a new deadline from the remaining time. Manual client confirmation remains
available during a hold. Admin reasons and timestamps are recorded in the private
audit table. Bookings already delivered when the migration runs are left eligible
for manual confirmation and require an explicit data migration to schedule.

Apply the completion migration before starting the worker or using the live
completion screens. Account bookings are under `/bookings`. Existing
`/bookings/live` links remain available. The administrator queue is at
`/admin/booking-completions`.

## Selected defaults and compatibility

The user explicitly authorized these implementation defaults on 2026-10-30;
that is not evidence of named team reviewers' approval.

- Draft question 1: explicit authenticated POST /me, normalized unique username,
  idempotent same-user retry. GET /me is read-only and reports `profile_required`.
- Questions 2/6: controlled genre/tone/setting/mood tags; generated and manipulated
  provenance labels remain visible. AI-generated concepts never become captured photos.
- Questions 9/11: retain the booking state machine and no cancellation fees.
  UC3 adds automatic completion and an administrator dispute hold.
  Room access belongs to client/current assignee/relevant current managers.
- Question 16: the MVP uses keyword search and filters. The AI search and portfolio
  indexing endpoints require `AI_SEARCH_ENABLED=true`. The uploads API returns 503
  for the search reference bucket when the flag is off. Existing search references
  retain their 24-hour expiry.
- Question 18: selection rounds retain history. Mutual cancellation remains
  available through proofing until delivery.
- Each AI proposal is only a draft. Confirmation calls the normal booking, brief,
  or milestone service. It cannot bypass permissions, availability, or state checks.

## Failure and privacy limits

Public discovery displays database-backed portfolio photographs, descriptions and assigned tags.
`GET /v1/portfolios` accepts `genre`, `tag` (slug), `q` (literal substring of title or description),
`sort` (`newest`, `oldest`, `name`), `page` and `pageSize`. Ordering includes an ID tie-breaker.
Responses include visible-image tags with optional Vietnamese names and taxonomy categories.
Anonymous Cloud reads retain RLS, publication, deletion and hidden-image checks; direct PostgreSQL
reads apply the same visibility conditions. Existing schemas without extended taxonomy columns
retain their original kind/name labels. No schema migration is required.

The browser has no role switcher, seeded fallback state or simulated workflow. Existing account
routes use authenticated APIs. Bookings include a month calendar and owned schedule blocks;
the notification bell uses the same account feed as the notification page. Explore loads twelve
collections per request, offers explicit loading of the next page and lazy-loads photographs.

Unknown paid-provider outcomes remain uncertain and are not automatically repeated.
The worker rechecks project access before reading private inputs. Originals are
preserved when generating edited derivatives. AI secrets remain server-only.

Reassignment rechecks current access on API, authenticated Storage and Realtime
requests. Issued short-lived gallery, reference and delivery URLs remain valid
until expiry. The portfolio media API rechecks publication and image visibility
for each managed Storage object. Legacy external image URLs retain the external
host's own access policy.

Model availability, measured retrieval quality, and real-output human review require
a configured, budgeted Gateway key. No mocked AI output is used as a substitute.
