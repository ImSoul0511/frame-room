# Constraints and indexes

**Confirmed:** MVP branch `supabase/migrations/20261030000100_mvp_core.sql` through `20261030000800_demo_daily_ai_limit.sql`. Column-level checks, primary/foreign keys and defaults appear verbatim in [table specifications](table-specifications.md).

| Invariant                    | SQL mechanism                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth identity and uniqueness | `profiles.id` FK to `auth.users`; unique `profiles.user_name`; one `photographers.user_id`; `user_roles.user_id` PK                                |
| Studio team                  | Composite PK `(studio_id,user_id)`; partial `uq_pending_invitation` on pending invitation; trigger prevents last manager and assigned departure    |
| Polymorphic provider         | `owner_type` with exactly one photographer/studio FK in services, portfolios and bookings                                                          |
| Booking                      | Unique `bookings.project_id`; positive ordered schedule; state enum; `version` for optimistic concurrency; unique `(booking_id,version)` in briefs |
| Schedule                     | GiST exclusion constraints on `schedule_entries` for overlapping photographer or resource `tstzrange`; deferred consistency triggers               |
| Proofing                     | One gallery/room/review per booking; selection PK `(gallery_id,image_id,round)`; unique Storage paths                                              |
| AI                           | Unique job request key; unique artifact job/path; vector `extensions.vector(768)`; nonnegative reserved USD; action expiry/version fields          |

Explicit MVP indexes: `uq_pending_invitation`, `idx_photographers_city`, `idx_photographers_genres` (GIN), `idx_studios_city`, `idx_members_user`, `idx_portfolio_provider`, `idx_images_portfolio`, `idx_services_provider`, `idx_projects_owner`, `idx_bookings_client`, `idx_bookings_assignment`, `idx_messages_room_cursor`, `idx_ai_jobs_status`, `idx_usage_month`, `idx_actions_project`, `idx_ai_messages_project`. Primary keys, unique constraints and exclusion constraints create additional backing indexes. Verify any later `CREATE INDEX` statements in migrations 2–8 before manual cloud setup.

Index design for `image_embeddings` is incomplete as a retrieval plan: MVP search filters candidate providers and computes cosine distance against matching model rows. A vector ANN index is not evidenced in the initial migration. Benchmark on the target dataset before adding one; choose operator class/parameterization for the selected model and workload.
