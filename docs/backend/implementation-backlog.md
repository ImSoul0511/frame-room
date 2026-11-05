# Backend implementation backlog

| Priority | Slice and acceptance evidence                                                                                                | Depends on                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| P0       | Agree exact shared schemas, success/error envelopes, status codes and OpenAPI response schemas with Frontend Developer       | MVP UI inventory                    |
| P0       | Verify Supabase JWT/email, implement own profile/photographer and role derivation; test forged claims and duplicate username | Cloud Auth, profiles schema         |
| P0       | Provider catalog, studios/team, services/portfolio; test public hiding and current manager removal                           | RLS, Storage                        |
| P0       | Projects, bookings, scheduling and room; test stale versions, overlapping slots, assignment race and private media           | SQL functions/exclusion constraints |
| P1       | Proofing, deliveries, reviews, reports/moderation; test state gating and unique review                                       | Booking flow                        |
| P1       | Async AI jobs/actions and replacement service adapter; test idempotency, unknown paid outcome, access recheck                | Dataset/model contract and queue    |
| P1       | Search index and evaluation; ensure 768-vector model agreement and no result from unpublished images                         | Licensed dataset                    |
| P2       | Readiness/observability contract and cloud deployment hardening                                                              | DevOps setup                        |

The MVP branch supplies code for all these slices, but `main` does not. “Implement” here means reconstruct against the agreed cloud target, not merge the entire MVP feature commit. Use `apps/api/src/verify-database.ts` and `tests/e2e/mvp.spec.ts` as scenario references; they have not been run in this documentation session.
