# MVP database and access model

New ordered SQL migrations implement business tables, PostgreSQL enum values,
UUIDv7 generation, Storage buckets, RLS, Realtime publication, pgvector(768), pgmq,
booking functions, deferred schedule consistency, and serialized spend reservations.
Generated `packages/shared/src/db.types.ts` reflects the local schema. The historical
[ERD](erd_v0.md) remains a design reference; migrations define implementation truth.

## Access matrix

| Actor                      | Public catalog                          | Private project/room/media                | Business writes                               | Moderation  |
| -------------------------- | --------------------------------------- | ----------------------------------------- | --------------------------------------------- | ----------- |
| Anonymous                  | Published, visible providers/portfolios | Denied                                    | Denied                                        | Denied      |
| Client                     | Allowed                                 | Own project/current booking               | Through authorized API                        | Report only |
| Photographer               | Allowed                                 | Current assigned personal/studio bookings | Own catalog and current provider operations   | Report only |
| Studio manager             | Allowed                                 | Current studio bookings                   | Current studio catalog/team/resources/booking | Report only |
| Unassigned/removed member  | Allowed                                 | Denied                                    | No private booking authority                  | Report only |
| Manually provisioned admin | Allowed, plus moderation inspection     | No blanket private-room access            | Moderation APIs                               | Allowed     |

All application public tables have RLS. Authenticated/anonymous clients have read
grants only; API business writes use the server's database connection with verified
caller claims and explicit service authorization. Privileged booking, queue and
budget RPCs are revoked from anonymous/authenticated PostgREST callers.

Studio manager authority derives from membership, photographer authority from a
photographer row, and admin from manually provisioned user_roles. Signup metadata
is never a source of authorization. Private RLS helpers avoid recursive policies.

## Transactions and failure invariants

- Unique usernames/profiles are enforced by PostgreSQL. Auth creation and explicit
  profile creation are separate; incomplete onboarding is repairable.
- Studio and initial manager are one transaction. Deferred checks reject removal
  of the last manager. Active assigned photographers cannot depart.
- Confirmation/rescheduling lock the booking and studio, verify current assignment,
  reserve photographer/resources with exclusion constraints, snapshot resources,
  and update room/events atomically. Conflicts roll everything back.
- Old agreed briefs remain effective until both sides approve a replacement.
- AI action confirmation checks caller, expiry, project/booking versions and current
  business rules in one transaction. A repeated applied confirmation is idempotent.
- Queue redelivery after provider start becomes uncertain rather than another paid
  call. Completed job redelivery does not create another artifact.
- Monthly spend reservations are serialized across API and worker processes. Billed
  completed requests use Gateway cost; pending/unknown requests retain reservations.

## Local verification

Run `pnpm db:start`, `pnpm demo:configure`, and `pnpm demo:seed`, then `pnpm test:db`.
It checks role isolation, rejected writes, full booking flow, conflicting slots,
reassignment, stale actions, job redelivery and budget limits. Most fixtures run in
a rolled-back transaction. The concurrency scenario commits only temporary records
and removes those exact fixture IDs afterward. Existing bookings are preserved.

Use `pnpm db:types` after applying migrations. `pnpm db:reset` is an explicit,
destructive local replay, never part of ordinary startup. Do not apply to hosted DBs.
