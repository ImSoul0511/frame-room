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

| Group         | Implemented interface                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Profiles      | GET/POST/PATCH `/v1/me`; GET `/v1/me/studios`, `/v1/me/invitations`                                                 |
| Photographers | GET lists/detail/me; POST/PATCH `/v1/photographers/me`                                                              |
| Discovery     | GET `/v1/explore`, `/v1/photographers`, `/v1/studios`, provider detail, `/v1/tags`; authenticated POST `/v1/search` |
| Studios       | POST/PATCH studios; team, membership roles/departure, invitations and responses, resources, dashboard               |
| Catalog       | Personal/studio portfolios and services, image registration/indexing/tags, service add-ons, soft deletion           |
| Projects      | GET/POST `/v1/creative-projects`, GET/PATCH detail; references, artifacts, assistant history, actions, jobs         |
| Assistant     | POST project `/assistant` for brief/action; POST project `/chat` for AI SDK UI streaming                            |
| AI jobs       | POST project `/ai-jobs` returns 202; GET project jobs or `/v1/ai-jobs/:id`                                          |
| AI actions    | POST `/v1/ai-actions/:id/confirm` or `/reject`; caller, state, expiry, and versions checked again                   |
| Booking       | GET/POST bookings; detail/workspace; POST transitions; PATCH schedule                                               |
| Agreement     | POST booking `/brief-versions`; POST a version's `/approve`                                                         |
| Shoot Room    | POST messages, milestones, decisions; PATCH milestone/decision state                                                |
| Proofing      | POST booking gallery-images, selections, selections/reopen                                                          |
| Completion    | POST booking deliveries and reviews; completed customer review is lifetime-unique                                   |
| Schedule      | GET `/v1/me/timeline`, `/v1/me/schedule`; POST/DELETE own/resource blocks                                           |
| Moderation    | POST reports; manually provisioned admin report listing/resolution and content hide/restore                         |
| Media         | POST `/v1/uploads?bucket=...&scopeId=...` with one multipart image; API validates, normalizes and writes Storage    |

`GET /v1/bookings/:id/workspace` aggregates the authorized booking, project, room,
briefs, messages, decisions, milestones, gallery, selection, delivery, and review.
Draft galleries and delivery files are not exposed to the client prematurely.
Private media URLs are signed for five minutes and refreshed by subsequent reads.

Unlike the historical draft's proposed direct browser uploads, this implementation
uploads through the API so Sharp can verify bytes, correct orientation, normalize
WebP, and create paired thumbnails. Storage path ownership is rechecked when the
file is registered. Images are limited to JPEG/PNG/WebP, 20 MB input and 40 million
decoded pixels; normalized previews are at most 1280 px and 2 MB, thumbnails 320 px.
Final deliveries are at most 20 MB. No RAW files or arbitrary remote image URLs.

## Selected defaults and compatibility

The user explicitly authorized these implementation defaults on 2026-10-30;
that is not evidence of named team reviewers' approval.

- Draft question 1: explicit authenticated POST /me, normalized unique username,
  idempotent same-user retry. GET /me is read-only and reports `profile_required`.
- Questions 2/6: controlled genre/tone/setting/mood tags; generated and manipulated
  provenance labels remain visible. AI-generated concepts never become captured photos.
- Questions 9/11: retain the booking state machine, no cancellation fees or automatic
  completion; room access belongs to client/current assignee/relevant current managers.
- Question 16: authenticated AI search, grouped provider results, 24-hour references.
- Question 18: selection rounds retain history. No cancellation after proofing.
- Each AI proposal is only a draft. Confirmation calls the normal booking, brief,
  or milestone service. It cannot bypass permissions, availability, or state checks.

## Failure and privacy limits

Unknown paid-provider outcomes remain uncertain and are not automatically repeated.
The worker rechecks project access before reading private inputs. Originals are
preserved when generating edited derivatives. AI secrets remain server-only.

Reassignment blocks new API/Storage/Realtime access immediately. Already-issued
signed URLs remain usable until their five-minute expiry. Public portfolio URLs
remain public despite API hiding; use media compatible with that access.

Model availability, measured retrieval quality, and real-output human review require
a configured, budgeted Gateway key. No mocked AI output is used as a substitute.
