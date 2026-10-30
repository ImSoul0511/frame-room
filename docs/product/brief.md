# FrameRoom product brief

## Problem and audience

Clients struggle to describe photographic styles and find providers. Photographers and small studios lose requirements, schedules, references, and feedback across separate channels.

FrameRoom brings clients, photographers, and studio managers into one AI-assisted browser workflow: describe an idea -> generate concepts -> discover providers -> agree on a Shoot Brief -> book -> collaborate -> select photos -> receive files -> review. English is the default; Vietnamese is a persistent selectable language.

## Product rules

- Public onboarding offers client or photographer; all accounts have client capability.
- A photographer profile is required before creating a studio.
- Photographers can create/join multiple studios; each active studio keeps a manager.
- Studio management derives from membership. Studios are providers, not separate logins.
- Retoucher/art director are display specialties, not authorization roles.
- Private collaboration/media is restricted to authorized participants.
- Booking history is retained; clients review only completed bookings.

## Phases and success

MVP-001 builds on the foundation with business APIs/schema, bilingual screens,
AI discovery/concepts/planning/culling/editing, studio scheduling, collaboration,
proofing, delivery, reviews and moderation. AI business changes require explicit
confirmation and normal authorization/state checks.

Follow [the backlog](../../plans/backlog.md): auth/profile, portfolio/discovery, services/booking/brief, Shoot Room, proofing/delivery/review. Introduce studio features alongside their dependent flows.

The user's 2026-10-30 implementation request supersedes the original AI deferral.
Community Rooms, payments, RAW storage, custom model training, desktop and hosting
remain deferred. Real AI quality/evaluation requires a budgeted Gateway key and
permitted benchmark data; missing prerequisites are not treated as a pass.

Success: the real local client/provider journey completes through review, access
and conflicts are enforced, and language switching persists without losing forms.
Database work remains reproducible through local migrations; Python is unnecessary.

The [contract](../api/contract_v0.md#20-open-decisions) and [ERD](../db/erd_v0.md#6-open-decisions) retain unresolved questions and owners. They are not frozen or implemented. Do not settle onboarding initialization, cancellations, participant scope, or quotas during tooling work.
