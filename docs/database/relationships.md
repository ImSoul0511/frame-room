# Confirmed foreign keys

Source: MVP branch `supabase/migrations/20261030000100_mvp_core.sql` and subsequent ordered migrations.

| Child column                                | Referenced key                 |
| ------------------------------------------- | ------------------------------ |
| `public.profiles.id`                        | `auth.users.id`                |
| `public.user_roles.user_id`                 | `public.profiles.id`           |
| `public.photographers.user_id`              | `public.profiles.id`           |
| `public.studios.created_by`                 | `public.photographers.user_id` |
| `public.studio_members.studio_id`           | `public.studios.id`            |
| `public.studio_members.user_id`             | `public.photographers.user_id` |
| `public.studio_invitations.studio_id`       | `public.studios.id`            |
| `public.studio_invitations.photographer_id` | `public.photographers.id`      |
| `public.studio_invitations.invited_by`      | `public.profiles.id`           |
| `public.services.photographer_id`           | `public.photographers.id`      |
| `public.services.studio_id`                 | `public.studios.id`            |
| `public.service_add_ons.service_id`         | `public.services.id`           |
| `public.studio_resources.studio_id`         | `public.studios.id`            |
| `public.portfolios.photographer_id`         | `public.photographers.id`      |
| `public.portfolios.studio_id`               | `public.studios.id`            |
| `public.portfolio_images.portfolio_id`      | `public.portfolios.id`         |
| `public.image_tags.portfolio_image_id`      | `public.portfolio_images.id`   |
| `public.image_tags.tag_id`                  | `public.tags.id`               |
| `public.creative_projects.owner_id`         | `public.profiles.id`           |
| `public.bookings.client_id`                 | `public.profiles.id`           |
| `public.bookings.project_id`                | `public.creative_projects.id`  |
| `public.bookings.service_id`                | `public.services.id`           |
| `public.bookings.photographer_id`           | `public.photographers.id`      |
| `public.bookings.studio_id`                 | `public.studios.id`            |
| `public.bookings.assigned_photographer_id`  | `public.photographers.id`      |
| `public.schedule_entries.booking_id`        | `public.bookings.id`           |
| `public.schedule_entries.photographer_id`   | `public.photographers.id`      |
| `public.schedule_entries.resource_id`       | `public.studio_resources.id`   |
| `public.booking_resources.booking_id`       | `public.bookings.id`           |
| `public.booking_resources.resource_id`      | `public.studio_resources.id`   |
| `public.brief_versions.booking_id`          | `public.bookings.id`           |
| `public.brief_versions.created_by`          | `public.profiles.id`           |
| `public.shoot_rooms.booking_id`             | `public.bookings.id`           |
| `public.room_messages.room_id`              | `public.shoot_rooms.id`        |
| `public.room_messages.sender_id`            | `public.profiles.id`           |
| `public.room_decisions.room_id`             | `public.shoot_rooms.id`        |
| `public.room_decisions.proposed_by`         | `public.profiles.id`           |
| `public.room_milestones.room_id`            | `public.shoot_rooms.id`        |
| `public.room_milestones.created_by`         | `public.profiles.id`           |
| `public.galleries.booking_id`               | `public.bookings.id`           |
| `public.gallery_images.gallery_id`          | `public.galleries.id`          |
| `public.gallery_selections.gallery_id`      | `public.galleries.id`          |
| `public.gallery_selections.image_id`        | `public.gallery_images.id`     |
| `public.gallery_selections.selected_by`     | `public.profiles.id`           |
| `public.deliveries.booking_id`              | `public.bookings.id`           |
| `public.reviews.booking_id`                 | `public.bookings.id`           |
| `public.reviews.author_id`                  | `public.profiles.id`           |
| `public.reviews.photographer_id`            | `public.photographers.id`      |
| `public.reviews.studio_id`                  | `public.studios.id`            |
| `public.content_reports.reporter_id`        | `public.profiles.id`           |
| `public.ai_messages.project_id`             | `public.creative_projects.id`  |
| `public.ai_messages.user_id`                | `public.profiles.id`           |
| `public.ai_jobs.project_id`                 | `public.creative_projects.id`  |
| `public.ai_jobs.user_id`                    | `public.profiles.id`           |
| `public.ai_artifacts.project_id`            | `public.creative_projects.id`  |
| `public.ai_artifacts.job_id`                | `public.ai_jobs.id`            |
| `public.ai_artifacts.original_image_id`     | `public.gallery_images.id`     |
| `public.image_embeddings.image_id`          | `public.portfolio_images.id`   |
| `public.ai_usage.user_id`                   | `public.profiles.id`           |
| `public.ai_usage.job_id`                    | `public.ai_jobs.id`            |
| `public.ai_actions.project_id`              | `public.creative_projects.id`  |
| `public.ai_actions.proposed_for`            | `public.profiles.id`           |
| `public.ai_actions.applied_by`              | `public.profiles.id`           |

`content_reports.target_type`/`target_id`, reference paths, and Storage paths are application links without a declared FK.
