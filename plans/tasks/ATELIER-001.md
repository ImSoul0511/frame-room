# ATELIER-001: FrameRoom Atelier product upgrade

Status: In Review
Owner: Codex
Base: origin/dev fe383027af1eafa915ac927c0be67b7012a77151
Branch: feature/ATELIER-001-product-upgrade

## Outcome

Implement the approved photography atelier direction across discovery, projects,
booking, collaboration, photo review, delivery, accounts and management. Primary
routes use real API-backed accounts. Preserve the existing booking lifecycle,
identities, permissions, histories, bilateral agreement and completion rules.

Implementation lives in the isolated worktree `D:/frame-room-atelier`. The original
`D:/frame-room` checkout and its unfinished editorial work are preserved. The local
contact sheet, viewer, comparison tools and permitted editorial images were ported
selectively onto current dev.

## Interface and behavior

- Shared warm-paper, ink and vermilion tokens theme existing Astryx primitives;
  photographic discovery, top navigation and mobile menu replace the former shell.
- Discovery filters persist in URLs. Provider booking preserves project/service
  context through authentication. Account routes cannot switch into a simulator.
- A development-only `/sandbox` isolates the retained simulation components.
- Project boards persist references, concepts and idea edits. Creative tools open
  in context or an optional, lazily loaded assistant dialog. Unconfigured AI has an
  explicit unavailable state; mock output is never substituted.
- Booking uses package, schedule, requirements and review steps. The final action
  creates the pending booking and initial brief through the existing transaction.
- Shoot overview and progress derive from existing lifecycle states. Photo review
  includes a dark contact sheet, keyboard viewer, comparison, quotas, persisted
  notes/pins and selection rounds. Secondary cancellation controls are collapsible.
- Mutations invalidate related resources, room reconnects refresh their workspace,
  and media refresh preserves viewer and draft state. AI job retries keep a request
  key after an unknown network outcome.
- Studio and own-photographer PostgreSQL projections cast enum arrays to text
  arrays. This fixes real manager/profile reads and studio write responses that
  previously violated the advertised JSON response shape.

## Contract impact

| Layer             | Change                                                                                                                  | Compatibility                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Runtime config    | Shared `runtimeConfigSchema` adds `aiConfigured` and `aiSearchEnabled` booleans                                         | Additive; no secret values                            |
| Projects          | PATCH accepts optional expected `version`; stale versions return 409 `stale_version` after the owner check and row lock | Existing callers may omit it; atelier editors send it |
| Booking workspace | Shared `bookingWorkspaceSchema`; optional signed `thumbnailUrl` on preview images                                       | Existing full-size URLs and fields retained           |
| Notifications     | Shared notification response schema                                                                                     | Existing shape preserved                              |
| OpenAPI           | Documents the typed config, booking, workspace and notification responses                                               | Route identifiers and error envelopes retained        |
| Routes            | Business registration split into booking/agreement, collaboration, proofing, studio, moderation and AI modules          | Existing services and transactional SQL reused        |
| Browser URLs      | Canonical persisted routes; old `/bookings/live` links redirect                                                         | Booking IDs preserved                                 |
| Database          | Two ordered milestone replay compatibility migrations                                                                   | No new business tables or role rules                  |

## Database replay repair

The core migration creates `room_milestones.updated_at`; the historical agreement
migration tries to add it again, breaking a fresh replay. New migrations at
`20261120000250` and `20261120000310` bridge that historical DDL without editing any
merged migration. The bridge temporarily renames the existing timestamp column,
then restores its values, default, not-null constraint and normal timestamp trigger.
Already upgraded schemas with `updated_by` skip the bridge.

Existing hosted projects need their migration history reviewed before applying
these earlier missing versions. Use a reviewed `--include-all` migration workflow;
never reset a hosted project. Ly/Khai database review remains required before merge.

## Acceptance and verification

See [verification](ATELIER-001-verification.md). Required scenarios include a real
two-account journey through review, refresh persistence, concurrent draft recovery,
discovery failure recovery, keyboard photo selection, responsive layouts, and the
existing RLS, transaction, budget, assignment and completion checks.

Cloud remains the intended demo target. No Cloud configuration was available; all
database execution in this task is supplemental local verification. Hosting,
payments, RAW files, desktop packaging and model training remain outside scope.
