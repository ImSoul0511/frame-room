# Database overview

**Confirmed MVP reference:** `feature/MVP-001-ai-focused-workflow` contains eight ordered files in `supabase/migrations/`, beginning `20261030000100_mvp_core.sql`. Checked out `main` has no business migration; `docs/db/erd_v0.md` there is a historical draft. The MVP SQL creates 34 `public` tables, a `providers` view, 11 PostgreSQL enum types, `private` authorization helpers, RLS, Storage buckets, Realtime publication, pgvector(768), and pgmq. [Table specifications](table-specifications.md) and [ERD](erd.md) are generated from confirmed SQL declarations.

`profiles.id` references Supabase managed `auth.users.id`; business IDs default to a SQL UUIDv7 generator. Server code verifies Auth identity, checks authorization and performs business writes through a privileged database connection. Browser clients have limited read grants and Storage policies. Never treat service-role bypass as an authorization decision.

| Area              | Confirmed tables                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/provider | `profiles`, `user_roles`, `photographers`, `studios`, `studio_members`, `studio_invitations`, `services`, `service_add_ons`, `studio_resources`                      |
| Catalog           | `portfolios`, `portfolio_images`, `tags`, `image_tags`                                                                                                               |
| Project/booking   | `creative_projects`, `bookings`, `schedule_entries`, `booking_resources`, `brief_versions`                                                                           |
| Room/proofing     | `shoot_rooms`, `room_messages`, `room_decisions`, `room_milestones`, `galleries`, `gallery_images`, `gallery_selections`, `deliveries`, `reviews`, `content_reports` |
| AI                | `ai_messages`, `ai_jobs`, `ai_artifacts`, `image_embeddings`, `ai_usage`, `ai_actions`                                                                               |

The historical draft ERD and API contract describe more fields/workflows than the foundation implemented. For cloud reconstruction, decide explicitly whether to reproduce the feature-branch SQL or adopt a revised contract. The `providers` view is created in migration 3 and adjusted by migrations 4; later migrations change concurrency, budget, concept selection and demo limits. Do not derive final schema solely from the first migration.
