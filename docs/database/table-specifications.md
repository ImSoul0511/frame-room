# Table specifications

Confirmed source: the eight ordered `supabase/migrations/20261030*.sql` files on the MVP branch. All are absent on checked out `main`. Definitions below preserve SQL column declarations. Read later ALTER statements in [constraints-and-indexes.md](constraints-and-indexes.md). `auth.users` and `storage.objects` are Supabase managed.

## `public.profiles`

| Column         | SQL declaration                                                                  |
| -------------- | -------------------------------------------------------------------------------- |
| `id`           | `id uuid primary key references auth.users(id) on delete cascade`                |
| `user_name`    | `user_name text not null unique check (user_name ~ '^[a-z0-9][a-z0-9_]{2,29}$')` |
| `display_name` | `display_name text not null check (length(display_name) between 1 and 60)`       |
| `avatar_path`  | `avatar_path text`                                                               |
| `created_at`   | `created_at timestamptz not null default now()`                                  |
| `updated_at`   | `updated_at timestamptz not null default now()`                                  |

## `public.user_roles`

| Column       | SQL declaration                                           |
| ------------ | --------------------------------------------------------- |
| `user_id`    | `user_id uuid primary key references public.profiles(id)` |
| `role`       | `role text not null check (role='system_admin')`          |
| `granted_at` | `granted_at timestamptz not null default now()`           |

## `public.photographers`

| Column         | SQL declaration                                                             |
| -------------- | --------------------------------------------------------------------------- |
| `id`           | `id uuid primary key default public.uuid_generate_v7()`                     |
| `user_id`      | `user_id uuid not null unique references public.profiles(id)`               |
| `display_name` | `display_name text not null check(length(display_name) between 1 and 60)`   |
| `bio`          | `bio text not null default ''`                                              |
| `city`         | `city text not null default ''`                                             |
| `district`     | `district text not null default ''`                                         |
| `genres`       | `genres public.genre[] not null check(cardinality(genres) between 1 and 5)` |
| `styles`       | `styles text[] not null default '{}'`                                       |
| `is_hidden`    | `is_hidden boolean not null default false`                                  |
| `created_at`   | `created_at timestamptz not null default now()`                             |
| `updated_at`   | `updated_at timestamptz not null default now()`                             |

## `public.studios`

| Column        | SQL declaration                                                     |
| ------------- | ------------------------------------------------------------------- |
| `id`          | `id uuid primary key default public.uuid_generate_v7()`             |
| `name`        | `name text not null check(length(name) between 1 and 80)`           |
| `description` | `description text not null default ''`                              |
| `city`        | `city text not null default ''`                                     |
| `district`    | `district text not null default ''`                                 |
| `address`     | `address text not null default ''`                                  |
| `genres`      | `genres public.genre[] not null`                                    |
| `created_by`  | `created_by uuid not null references public.photographers(user_id)` |
| `is_hidden`   | `is_hidden boolean not null default false`                          |
| `deleted_at`  | `deleted_at timestamptz`                                            |
| `created_at`  | `created_at timestamptz not null default now()`                     |
| `updated_at`  | `updated_at timestamptz not null default now()`                     |

## `public.studio_members`

| Column      | SQL declaration                                                  |
| ----------- | ---------------------------------------------------------------- |
| `studio_id` | `studio_id uuid not null references public.studios(id)`          |
| `user_id`   | `user_id uuid not null references public.photographers(user_id)` |
| `role`      | `role public.studio_member_role not null`                        |
| `joined_at` | `joined_at timestamptz not null default now()`                   |

Table constraints: `primary key(studio_id,user_id)`.

## `public.studio_invitations`

| Column            | SQL declaration                                                     |
| ----------------- | ------------------------------------------------------------------- |
| `id`              | `id uuid primary key default public.uuid_generate_v7()`             |
| `studio_id`       | `studio_id uuid not null references public.studios(id)`             |
| `photographer_id` | `photographer_id uuid not null references public.photographers(id)` |
| `role`            | `role public.studio_member_role not null default 'photographer'`    |
| `status`          | `status public.invitation_status not null default 'pending'`        |
| `invited_by`      | `invited_by uuid not null references public.profiles(id)`           |
| `responded_at`    | `responded_at timestamptz`                                          |
| `created_at`      | `created_at timestamptz not null default now()`                     |
| `updated_at`      | `updated_at timestamptz not null default now()`                     |

## `public.services`

| Column             | SQL declaration                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| `id`               | `id uuid primary key default public.uuid_generate_v7()`                         |
| `owner_type`       | `owner_type public.provider_type not null`                                      |
| `photographer_id`  | `photographer_id uuid references public.photographers(id)`                      |
| `studio_id`        | `studio_id uuid references public.studios(id)`                                  |
| `name`             | `name text not null`                                                            |
| `description`      | `description text not null default ''`                                          |
| `genre`            | `genre public.genre not null`                                                   |
| `duration_minutes` | `duration_minutes integer not null check(duration_minutes between 15 and 1440)` |
| `price`            | `price integer not null check(price>=0)`                                        |
| `photo_count`      | `photo_count integer not null default 10 check(photo_count>=0)`                 |
| `retouched_count`  | `retouched_count integer not null default 5 check(retouched_count>=0)`          |
| `is_active`        | `is_active boolean not null default true`                                       |
| `deleted_at`       | `deleted_at timestamptz`                                                        |
| `created_at`       | `created_at timestamptz not null default now()`                                 |
| `updated_at`       | `updated_at timestamptz not null default now()`                                 |

Table constraints: `check ((owner_type='photographer' and photographer_id is not null and studio_id is null) or (owner_type='studio' and studio_id is not null and photographer_id is null))`.

## `public.service_add_ons`

| Column        | SQL declaration                                           |
| ------------- | --------------------------------------------------------- |
| `id`          | `id uuid primary key default public.uuid_generate_v7()`   |
| `service_id`  | `service_id uuid not null references public.services(id)` |
| `name`        | `name text not null`                                      |
| `description` | `description text not null default ''`                    |
| `price`       | `price integer not null check(price>=0)`                  |
| `is_active`   | `is_active boolean not null default true`                 |
| `deleted_at`  | `deleted_at timestamptz`                                  |
| `created_at`  | `created_at timestamptz not null default now()`           |
| `updated_at`  | `updated_at timestamptz not null default now()`           |

## `public.studio_resources`

| Column        | SQL declaration                                         |
| ------------- | ------------------------------------------------------- |
| `id`          | `id uuid primary key default public.uuid_generate_v7()` |
| `studio_id`   | `studio_id uuid not null references public.studios(id)` |
| `name`        | `name text not null`                                    |
| `type`        | `type public.resource_type not null`                    |
| `description` | `description text not null default ''`                  |
| `is_active`   | `is_active boolean not null default true`               |
| `deleted_at`  | `deleted_at timestamptz`                                |
| `created_at`  | `created_at timestamptz not null default now()`         |
| `updated_at`  | `updated_at timestamptz not null default now()`         |

## `public.portfolios`

| Column            | SQL declaration                                            |
| ----------------- | ---------------------------------------------------------- |
| `id`              | `id uuid primary key default public.uuid_generate_v7()`    |
| `owner_type`      | `owner_type public.provider_type not null`                 |
| `photographer_id` | `photographer_id uuid references public.photographers(id)` |
| `studio_id`       | `studio_id uuid references public.studios(id)`             |
| `title`           | `title text not null`                                      |
| `description`     | `description text not null default ''`                     |
| `genre`           | `genre public.genre not null`                              |
| `status`          | `status public.portfolio_status not null default 'draft'`  |
| `published_at`    | `published_at timestamptz`                                 |
| `deleted_at`      | `deleted_at timestamptz`                                   |
| `created_at`      | `created_at timestamptz not null default now()`            |
| `updated_at`      | `updated_at timestamptz not null default now()`            |

Table constraints: `check ((owner_type='photographer' and photographer_id is not null and studio_id is null) or (owner_type='studio' and studio_id is not null and photographer_id is null))`.

## `public.portfolio_images`

| Column         | SQL declaration                                               |
| -------------- | ------------------------------------------------------------- |
| `id`           | `id uuid primary key default public.uuid_generate_v7()`       |
| `portfolio_id` | `portfolio_id uuid not null references public.portfolios(id)` |
| `storage_path` | `storage_path text not null unique`                           |
| `width`        | `width integer not null check(width between 1 and 1280)`      |
| `height`       | `height integer not null check(height between 1 and 1280)`    |
| `caption`      | `caption text not null default ''`                            |
| `provenance`   | `provenance public.provenance not null default 'captured'`    |
| `sort_order`   | `sort_order integer not null default 0`                       |
| `is_hidden`    | `is_hidden boolean not null default false`                    |
| `source`       | `source text`                                                 |
| `collected_at` | `collected_at timestamptz`                                    |
| `license_note` | `license_note text`                                           |
| `created_at`   | `created_at timestamptz not null default now()`               |
| `updated_at`   | `updated_at timestamptz not null default now()`               |

## `public.tags`

| Column | SQL declaration                                         |
| ------ | ------------------------------------------------------- |
| `id`   | `id uuid primary key default public.uuid_generate_v7()` |
| `slug` | `slug text not null unique`                             |
| `name` | `name text not null`                                    |
| `kind` | `kind public.tag_kind not null`                         |

## `public.image_tags`

| Column               | SQL declaration                                                           |
| -------------------- | ------------------------------------------------------------------------- |
| `portfolio_image_id` | `portfolio_image_id uuid not null references public.portfolio_images(id)` |
| `tag_id`             | `tag_id uuid not null references public.tags(id)`                         |
| `source`             | `source text not null check(source in ('manual','ai'))`                   |
| `confidence`         | `confidence real check(confidence between 0 and 1)`                       |

Table constraints: `primary key(portfolio_image_id,tag_id)`.

## `public.creative_projects`

| Column            | SQL declaration                                         |
| ----------------- | ------------------------------------------------------- |
| `id`              | `id uuid primary key default public.uuid_generate_v7()` |
| `owner_id`        | `owner_id uuid not null references public.profiles(id)` |
| `title`           | `title text not null`                                   |
| `idea`            | `idea text not null`                                    |
| `brief`           | `brief jsonb`                                           |
| `reference_paths` | `reference_paths text[] not null default '{}'`          |
| `version`         | `version integer not null default 1`                    |
| `created_at`      | `created_at timestamptz not null default now()`         |
| `updated_at`      | `updated_at timestamptz not null default now()`         |

## `public.bookings`

| Column                                 | SQL declaration                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                   | `id uuid primary key default public.uuid_generate_v7()`                                                                                                                   |
| `client_id`                            | `client_id uuid not null references public.profiles(id)`                                                                                                                  |
| `project_id`                           | `project_id uuid not null unique references public.creative_projects(id)`                                                                                                 |
| `service_id`                           | `service_id uuid not null references public.services(id)`                                                                                                                 |
| `owner_type`                           | `owner_type public.provider_type not null`                                                                                                                                |
| `photographer_id`                      | `photographer_id uuid references public.photographers(id)`                                                                                                                |
| `studio_id`                            | `studio_id uuid references public.studios(id)`                                                                                                                            |
| `assigned_photographer_id`             | `assigned_photographer_id uuid references public.photographers(id)`                                                                                                       |
| `status`                               | `status public.booking_status not null default 'pending'`                                                                                                                 |
| `scheduled_start`                      | `scheduled_start timestamptz not null`                                                                                                                                    |
| `scheduled_end`                        | `scheduled_end timestamptz not null`                                                                                                                                      |
| `total_price`                          | `total_price integer not null check(total_price>=0)`                                                                                                                      |
| `service_name`                         | `service_name text not null`                                                                                                                                              |
| `service_snapshot`                     | `service_snapshot jsonb not null`                                                                                                                                         |
| `note`                                 | `note text not null default ''`                                                                                                                                           |
| `version`                              | `version integer not null default 1`                                                                                                                                      |
| `agreed_brief_version`                 | `agreed_brief_version integer`                                                                                                                                            |
| `created_at`                           | `created_at timestamptz not null default now()`                                                                                                                           |
| `updated_at`                           | `updated_at timestamptz not null default now()`                                                                                                                           |
| `check(scheduled_end>scheduled_start)` | `check(scheduled_end>scheduled_start)`                                                                                                                                    |
| `check((owner_type='photographer'`     | `check((owner_type='photographer' and photographer_id is not null and studio_id is null) or (owner_type='studio' and studio_id is not null and photographer_id is null))` |

## `public.schedule_entries`

| Column                                               | SQL declaration                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                 | `id uuid primary key default public.uuid_generate_v7()`                                                                                                                  |
| `booking_id`                                         | `booking_id uuid references public.bookings(id)`                                                                                                                         |
| `photographer_id`                                    | `photographer_id uuid references public.photographers(id)`                                                                                                               |
| `resource_id`                                        | `resource_id uuid references public.studio_resources(id)`                                                                                                                |
| `during`                                             | `during tstzrange not null`                                                                                                                                              |
| `label`                                              | `label text not null default ''`                                                                                                                                         |
| `created_at`                                         | `created_at timestamptz not null default now()`                                                                                                                          |
| `check(num_nonnulls(photographer_id,resource_id)=1)` | `check(num_nonnulls(photographer_id,resource_id)=1)`                                                                                                                     |
| `check(not`                                          | `check(not isempty(during) and lower(during) is not null and upper(during) is not null and lower(during)<upper(during) and lower_inc(during) and not upper_inc(during))` |

Table constraints: `exclude using gist(photographer_id with =, during with &&) where (photographer_id is not null)`; `exclude using gist(resource_id with =, during with &&) where (resource_id is not null)`.

## `public.booking_resources`

| Column        | SQL declaration                                                    |
| ------------- | ------------------------------------------------------------------ |
| `booking_id`  | `booking_id uuid not null references public.bookings(id)`          |
| `resource_id` | `resource_id uuid not null references public.studio_resources(id)` |
| `name`        | `name text not null`                                               |
| `type`        | `type public.resource_type not null`                               |

Table constraints: `primary key(booking_id,resource_id)`.

## `public.brief_versions`

| Column                       | SQL declaration                                           |
| ---------------------------- | --------------------------------------------------------- |
| `id`                         | `id uuid primary key default public.uuid_generate_v7()`   |
| `booking_id`                 | `booking_id uuid not null references public.bookings(id)` |
| `version`                    | `version integer not null`                                |
| `content`                    | `content jsonb not null`                                  |
| `created_by`                 | `created_by uuid not null references public.profiles(id)` |
| `client_approved`            | `client_approved boolean not null default false`          |
| `provider_approved`          | `provider_approved boolean not null default false`        |
| `created_at`                 | `created_at timestamptz not null default now()`           |
| `unique(booking_id,version)` | `unique(booking_id,version)`                              |

## `public.shoot_rooms`

| Column       | SQL declaration                                                          |
| ------------ | ------------------------------------------------------------------------ |
| `id`         | `id uuid primary key default public.uuid_generate_v7()`                  |
| `booking_id` | `booking_id uuid not null unique references public.bookings(id)`         |
| `status`     | `status text not null default 'open' check(status in ('open','closed'))` |
| `created_at` | `created_at timestamptz not null default now()`                          |

## `public.room_messages`

| Column         | SQL declaration                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| `id`           | `id uuid primary key default public.uuid_generate_v7()`                      |
| `room_id`      | `room_id uuid not null references public.shoot_rooms(id)`                    |
| `sender_id`    | `sender_id uuid references public.profiles(id)`                              |
| `text`         | `text text not null`                                                         |
| `storage_path` | `storage_path text`                                                          |
| `type`         | `type text not null default 'text' check(type in ('text','image','system'))` |
| `is_hidden`    | `is_hidden boolean not null default false`                                   |
| `created_at`   | `created_at timestamptz not null default now()`                              |

## `public.room_decisions`

| Column        | SQL declaration                                                                             |
| ------------- | ------------------------------------------------------------------------------------------- |
| `id`          | `id uuid primary key default public.uuid_generate_v7()`                                     |
| `room_id`     | `room_id uuid not null references public.shoot_rooms(id)`                                   |
| `title`       | `title text not null`                                                                       |
| `description` | `description text not null default ''`                                                      |
| `proposed_by` | `proposed_by uuid not null references public.profiles(id)`                                  |
| `status`      | `status text not null default 'proposed' check(status in ('proposed','agreed','rejected'))` |
| `created_at`  | `created_at timestamptz not null default now()`                                             |
| `updated_at`  | `updated_at timestamptz not null default now()`                                             |

## `public.room_milestones`

| Column       | SQL declaration                                                        |
| ------------ | ---------------------------------------------------------------------- |
| `id`         | `id uuid primary key default public.uuid_generate_v7()`                |
| `room_id`    | `room_id uuid not null references public.shoot_rooms(id)`              |
| `title`      | `title text not null`                                                  |
| `due_at`     | `due_at timestamptz`                                                   |
| `status`     | `status text not null default 'todo' check(status in ('todo','done'))` |
| `created_by` | `created_by uuid not null references public.profiles(id)`              |
| `created_at` | `created_at timestamptz not null default now()`                        |
| `updated_at` | `updated_at timestamptz not null default now()`                        |

## `public.galleries`

| Column       | SQL declaration                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `id`         | `id uuid primary key default public.uuid_generate_v7()`                                                                  |
| `booking_id` | `booking_id uuid not null unique references public.bookings(id)`                                                         |
| `status`     | `status text not null default 'draft' check(status in ('draft','open_for_selection','selection_submitted','finalized'))` |
| `round`      | `round integer not null default 1`                                                                                       |
| `created_at` | `created_at timestamptz not null default now()`                                                                          |
| `updated_at` | `updated_at timestamptz not null default now()`                                                                          |

## `public.gallery_images`

| Column         | SQL declaration                                            |
| -------------- | ---------------------------------------------------------- |
| `id`           | `id uuid primary key default public.uuid_generate_v7()`    |
| `gallery_id`   | `gallery_id uuid not null references public.galleries(id)` |
| `storage_path` | `storage_path text not null unique`                        |
| `caption`      | `caption text not null default ''`                         |
| `provenance`   | `provenance public.provenance not null default 'captured'` |
| `width`        | `width integer not null`                                   |
| `height`       | `height integer not null`                                  |
| `created_at`   | `created_at timestamptz not null default now()`            |

## `public.gallery_selections`

| Column        | SQL declaration                                               |
| ------------- | ------------------------------------------------------------- |
| `gallery_id`  | `gallery_id uuid not null references public.galleries(id)`    |
| `image_id`    | `image_id uuid not null references public.gallery_images(id)` |
| `round`       | `round integer not null`                                      |
| `selected_by` | `selected_by uuid not null references public.profiles(id)`    |
| `created_at`  | `created_at timestamptz not null default now()`               |

Table constraints: `primary key(gallery_id,image_id,round)`.

## `public.deliveries`

| Column         | SQL declaration                                                                       |
| -------------- | ------------------------------------------------------------------------------------- |
| `id`           | `id uuid primary key default public.uuid_generate_v7()`                               |
| `booking_id`   | `booking_id uuid not null references public.bookings(id)`                             |
| `storage_path` | `storage_path text not null unique`                                                   |
| `file_name`    | `file_name text not null`                                                             |
| `mime_type`    | `mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp'))` |
| `created_at`   | `created_at timestamptz not null default now()`                                       |

## `public.reviews`

| Column            | SQL declaration                                                  |
| ----------------- | ---------------------------------------------------------------- |
| `id`              | `id uuid primary key default public.uuid_generate_v7()`          |
| `booking_id`      | `booking_id uuid not null unique references public.bookings(id)` |
| `author_id`       | `author_id uuid not null references public.profiles(id)`         |
| `photographer_id` | `photographer_id uuid references public.photographers(id)`       |
| `studio_id`       | `studio_id uuid references public.studios(id)`                   |
| `rating`          | `rating integer not null check(rating between 1 and 5)`          |
| `comment`         | `comment text not null default ''`                               |
| `is_hidden`       | `is_hidden boolean not null default false`                       |
| `deleted_at`      | `deleted_at timestamptz`                                         |
| `created_at`      | `created_at timestamptz not null default now()`                  |
| `updated_at`      | `updated_at timestamptz not null default now()`                  |

## `public.content_reports`

| Column        | SQL declaration                                                            |
| ------------- | -------------------------------------------------------------------------- |
| `id`          | `id uuid primary key default public.uuid_generate_v7()`                    |
| `reporter_id` | `reporter_id uuid not null references public.profiles(id)`                 |
| `target_type` | `target_type text not null`                                                |
| `target_id`   | `target_id uuid not null`                                                  |
| `reason`      | `reason text not null`                                                     |
| `description` | `description text not null`                                                |
| `status`      | `status text not null default 'open' check(status in ('open','resolved'))` |
| `created_at`  | `created_at timestamptz not null default now()`                            |
| `updated_at`  | `updated_at timestamptz not null default now()`                            |

## `public.ai_messages`

| Column       | SQL declaration                                                    |
| ------------ | ------------------------------------------------------------------ |
| `id`         | `id uuid primary key default public.uuid_generate_v7()`            |
| `project_id` | `project_id uuid not null references public.creative_projects(id)` |
| `user_id`    | `user_id uuid not null references public.profiles(id)`             |
| `role`       | `role text not null check(role in ('user','assistant'))`           |
| `content`    | `content text not null`                                            |
| `created_at` | `created_at timestamptz not null default now()`                    |

## `public.ai_jobs`

| Column                | SQL declaration                                           |
| --------------------- | --------------------------------------------------------- |
| `id`                  | `id uuid primary key default public.uuid_generate_v7()`   |
| `project_id`          | `project_id uuid references public.creative_projects(id)` |
| `user_id`             | `user_id uuid not null references public.profiles(id)`    |
| `kind`                | `kind public.job_kind not null`                           |
| `status`              | `status public.job_status not null default 'queued'`      |
| `input`               | `input jsonb not null`                                    |
| `result`              | `result jsonb`                                            |
| `error`               | `error text`                                              |
| `request_key`         | `request_key uuid not null unique`                        |
| `started_at`          | `started_at timestamptz`                                  |
| `completed_at`        | `completed_at timestamptz`                                |
| `provider_started_at` | `provider_started_at timestamptz`                         |
| `created_at`          | `created_at timestamptz not null default now()`           |
| `updated_at`          | `updated_at timestamptz not null default now()`           |

## `public.ai_artifacts`

| Column              | SQL declaration                                                    |
| ------------------- | ------------------------------------------------------------------ |
| `id`                | `id uuid primary key default public.uuid_generate_v7()`            |
| `project_id`        | `project_id uuid not null references public.creative_projects(id)` |
| `job_id`            | `job_id uuid not null unique references public.ai_jobs(id)`        |
| `storage_path`      | `storage_path text not null unique`                                |
| `provenance`        | `provenance public.provenance not null`                            |
| `original_image_id` | `original_image_id uuid references public.gallery_images(id)`      |
| `prompt`            | `prompt text not null`                                             |
| `created_at`        | `created_at timestamptz not null default now()`                    |

## `public.image_embeddings`

| Column        | SQL declaration                                                    |
| ------------- | ------------------------------------------------------------------ |
| `image_id`    | `image_id uuid primary key references public.portfolio_images(id)` |
| `description` | `description text not null`                                        |
| `model`       | `model text not null`                                              |
| `embedding`   | `embedding extensions.vector(768) not null`                        |
| `created_at`  | `created_at timestamptz not null default now()`                    |
| `updated_at`  | `updated_at timestamptz not null default now()`                    |

## `public.ai_usage`

| Column          | SQL declaration                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`            | `id uuid primary key default public.uuid_generate_v7()`                                                    |
| `user_id`       | `user_id uuid not null references public.profiles(id)`                                                     |
| `job_id`        | `job_id uuid references public.ai_jobs(id)`                                                                |
| `feature`       | `feature text not null`                                                                                    |
| `model`         | `model text not null`                                                                                      |
| `reserved_usd`  | `reserved_usd numeric(12,6) not null check(reserved_usd>=0)`                                               |
| `actual_usd`    | `actual_usd numeric(12,6)`                                                                                 |
| `status`        | `status text not null default 'reserved' check(status in ('reserved','completed','uncertain','released'))` |
| `image_count`   | `image_count integer not null default 0`                                                                   |
| `input_tokens`  | `input_tokens integer`                                                                                     |
| `output_tokens` | `output_tokens integer`                                                                                    |
| `created_at`    | `created_at timestamptz not null default now()`                                                            |

## `public.ai_actions`

| Column            | SQL declaration                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | `id uuid primary key default public.uuid_generate_v7()`                                                                              |
| `project_id`      | `project_id uuid not null references public.creative_projects(id)`                                                                   |
| `proposed_for`    | `proposed_for uuid not null references public.profiles(id)`                                                                          |
| `kind`            | `kind text not null check(kind in ('update_brief','create_milestone','request_booking','reschedule_booking','assign_photographer'))` |
| `explanation`     | `explanation text not null`                                                                                                          |
| `payload`         | `payload jsonb not null`                                                                                                             |
| `status`          | `status text not null default 'proposed' check(status in ('proposed','applied','rejected'))`                                         |
| `project_version` | `project_version integer not null`                                                                                                   |
| `booking_version` | `booking_version integer`                                                                                                            |
| `expires_at`      | `expires_at timestamptz not null default now()+interval '15 minutes'`                                                                |
| `applied_by`      | `applied_by uuid references public.profiles(id)`                                                                                     |
| `applied_at`      | `applied_at timestamptz`                                                                                                             |
| `created_at`      | `created_at timestamptz not null default now()`                                                                                      |
