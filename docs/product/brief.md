# FrameRoom product brief

## Problem and audience

Clients struggle to describe photographic styles and find providers. Photographers and small studios lose requirements, schedules, references, and feedback across separate channels.

FrameRoom brings clients, photographers, and studio managers into one browser workflow: discover portfolios -> agree on a Shoot Brief -> book -> collaborate in a private Shoot Room -> select photos -> receive files -> review.

## Product rules

- Public onboarding offers client or photographer; all accounts have client capability.
- A photographer profile is required before creating a studio.
- Photographers can create/join multiple studios; each active studio keeps a manager.
- Studio management derives from membership. Studios are providers, not separate logins.
- Retoucher/art director are display specialties, not authorization roles.
- Private collaboration/media is restricted to authorized participants.
- Booking history is retained; clients review only completed bookings.

## Phases and success

Foundation delivers tooling, agent artifacts, health connectivity, and local database commands. It does not implement business endpoints or schema.

Follow [the backlog](../../plans/backlog.md): auth/profile, portfolio/discovery, services/booking/brief, Shoot Room, proofing/delivery/review. Introduce studio features alongside their dependent flows.

AI search and Tauri are later phases. AI Concept Studio, Community Rooms, payments, RAW storage, and deployment automation are outside foundation. Existing AI contract sketches remain deferred designs.

Success: a developer can clone, install, run web/API, see their connection, and run checks without Python/cloud credentials. Database work is reproducible through local Supabase migrations.

The [contract](../api/contract_v0.md#20-open-decisions) and [ERD](../db/erd_v0.md#6-open-decisions) retain unresolved questions and owners. They are not frozen or implemented. Do not settle onboarding initialization, cancellations, participant scope, or quotas during tooling work.
