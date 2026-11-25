-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  user_name text NOT NULL UNIQUE CHECK (user_name ~ '^[a-z0-9][a-z0-9_]{2,29}$'::text),
  display_name text NOT NULL CHECK (length(display_name) >= 1 AND length(display_name) <= 60),
  avatar_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = 'system_admin'::text),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.photographers (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(display_name) >= 1 AND length(display_name) <= 60),
  bio text NOT NULL DEFAULT ''::text,
  city text NOT NULL DEFAULT ''::text,
  district text NOT NULL DEFAULT ''::text,
  genres ARRAY NOT NULL CHECK (cardinality(genres) >= 1 AND cardinality(genres) <= 5),
  styles ARRAY NOT NULL DEFAULT '{}'::text[],
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  dataset_key text,
  dataset_sort_order integer NOT NULL DEFAULT 0,
  contact_email text,
  professional_roles ARRAY NOT NULL DEFAULT '{}'::text[] CHECK (professional_roles <@ ARRAY['photographer'::text, 'retoucher'::text, 'art_director'::text]),
  cover_path text,
  CONSTRAINT photographers_pkey PRIMARY KEY (id),
  CONSTRAINT photographers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.studios (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  name text NOT NULL CHECK (length(name) >= 1 AND length(name) <= 80),
  description text NOT NULL DEFAULT ''::text,
  city text NOT NULL DEFAULT ''::text,
  district text NOT NULL DEFAULT ''::text,
  address text NOT NULL DEFAULT ''::text,
  genres ARRAY NOT NULL,
  created_by uuid NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_email text,
  CONSTRAINT studios_pkey PRIMARY KEY (id),
  CONSTRAINT studios_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.studio_members (
  studio_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT studio_members_pkey PRIMARY KEY (studio_id, user_id),
  CONSTRAINT studio_members_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id),
  CONSTRAINT studio_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.studio_invitations (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  studio_id uuid NOT NULL,
  photographer_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'photographer'::studio_member_role,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::invitation_status,
  invited_by uuid NOT NULL,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT studio_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT studio_invitations_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id),
  CONSTRAINT studio_invitations_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id),
  CONSTRAINT studio_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  owner_type USER-DEFINED NOT NULL,
  photographer_id uuid,
  studio_id uuid,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  genre USER-DEFINED NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes >= 15 AND duration_minutes <= 1440),
  price integer NOT NULL CHECK (price >= 0),
  photo_count integer NOT NULL DEFAULT 10 CHECK (photo_count >= 0),
  retouched_count integer NOT NULL DEFAULT 5 CHECK (retouched_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  selection_quota integer CHECK (selection_quota >= 1 AND selection_quota <= 200),
  revision_limit integer CHECK (revision_limit >= 0 AND revision_limit <= 100),
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id),
  CONSTRAINT services_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id)
);
CREATE TABLE public.service_add_ons (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  service_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  price integer NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT service_add_ons_pkey PRIMARY KEY (id),
  CONSTRAINT service_add_ons_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)
);
CREATE TABLE public.studio_resources (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  studio_id uuid NOT NULL,
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT studio_resources_pkey PRIMARY KEY (id),
  CONSTRAINT studio_resources_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id)
);
CREATE TABLE public.portfolios (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  owner_type USER-DEFINED NOT NULL,
  photographer_id uuid,
  studio_id uuid,
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  genre USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::portfolio_status,
  published_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  dataset_key text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT portfolios_pkey PRIMARY KEY (id),
  CONSTRAINT portfolios_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id),
  CONSTRAINT portfolios_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id)
);
CREATE TABLE public.portfolio_images (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  portfolio_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  width integer NOT NULL CHECK (width >= 1 AND width <= 1280),
  height integer NOT NULL CHECK (height >= 1 AND height <= 1280),
  caption text NOT NULL DEFAULT ''::text,
  provenance USER-DEFINED NOT NULL DEFAULT 'captured'::provenance,
  sort_order integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  dataset_key text,
  content_sha256 text CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'::text),
  suggested_genre text CHECK (suggested_genre IS NULL OR (suggested_genre = ANY (ARRAY['portrait'::text, 'fashion'::text, 'wedding'::text, 'family'::text, 'product'::text, 'food'::text, 'event'::text, 'cosplay'::text, 'drink'::text, 'yearbook'::text, 'outdoor'::text, 'tet_holiday'::text]))),
  label_status text NOT NULL DEFAULT 'unlabeled'::text CHECK (label_status = ANY (ARRAY['unlabeled'::text, 'suggested'::text, 'reviewed'::text])),
  import_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  collected_at timestamp with time zone,
  license_note text,
  crew_credits text NOT NULL DEFAULT ''::text,
  CONSTRAINT portfolio_images_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_images_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind USER-DEFINED NOT NULL,
  category text NOT NULL DEFAULT 'mood'::text CHECK (category = ANY (ARRAY['genre'::text, 'subject'::text, 'setting'::text, 'lighting'::text, 'color_tone'::text, 'mood'::text, 'composition'::text, 'style'::text, 'editing'::text, 'styling'::text, 'source'::text])),
  name_vi text,
  definition_en text,
  definition_vi text,
  aliases ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.image_tags (
  portfolio_image_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  source text NOT NULL CHECK (source = ANY (ARRAY['manual'::text, 'ai'::text, 'metadata'::text])),
  confidence real CHECK (confidence >= 0::double precision AND confidence <= 1::double precision),
  CONSTRAINT image_tags_pkey PRIMARY KEY (portfolio_image_id, tag_id),
  CONSTRAINT image_tags_portfolio_image_id_fkey FOREIGN KEY (portfolio_image_id) REFERENCES public.portfolio_images(id),
  CONSTRAINT image_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.creative_projects (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  idea text NOT NULL,
  brief jsonb,
  reference_paths ARRAY NOT NULL DEFAULT '{}'::text[],
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  selected_artifact_ids ARRAY NOT NULL DEFAULT '{}'::uuid[] CHECK (cardinality(selected_artifact_ids) <= 12),
  deleted_at timestamp with time zone,
  CONSTRAINT creative_projects_pkey PRIMARY KEY (id),
  CONSTRAINT creative_projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  client_id uuid NOT NULL,
  project_id uuid NOT NULL UNIQUE,
  service_id uuid NOT NULL,
  owner_type USER-DEFINED NOT NULL,
  photographer_id uuid,
  studio_id uuid,
  assigned_photographer_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::booking_status,
  scheduled_start timestamp with time zone NOT NULL,
  scheduled_end timestamp with time zone NOT NULL,
  total_price integer NOT NULL CHECK (total_price >= 0),
  service_name text NOT NULL,
  service_snapshot jsonb NOT NULL,
  note text NOT NULL DEFAULT ''::text,
  version integer NOT NULL DEFAULT 1,
  agreed_brief_version integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completion_due_at timestamp with time zone,
  completion_hold_at timestamp with time zone,
  completion_remaining_ms integer,
  conversation_id uuid,
  request_key uuid,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id),
  CONSTRAINT bookings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.creative_projects(id),
  CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
  CONSTRAINT bookings_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id),
  CONSTRAINT bookings_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id),
  CONSTRAINT bookings_assigned_photographer_id_fkey FOREIGN KEY (assigned_photographer_id) REFERENCES public.photographers(id)
);
CREATE TABLE public.schedule_entries (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid,
  photographer_id uuid,
  resource_id uuid,
  during tstzrange NOT NULL CHECK (NOT isempty(during) AND lower(during) IS NOT NULL AND upper(during) IS NOT NULL AND lower(during) < upper(during) AND lower_inc(during) AND NOT upper_inc(during)),
  label text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT schedule_entries_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_entries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT schedule_entries_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id),
  CONSTRAINT schedule_entries_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.studio_resources(id)
);
CREATE TABLE public.booking_resources (
  booking_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  CONSTRAINT booking_resources_pkey PRIMARY KEY (booking_id, resource_id),
  CONSTRAINT booking_resources_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_resources_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.studio_resources(id)
);
CREATE TABLE public.brief_versions (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid NOT NULL,
  version integer NOT NULL,
  content jsonb NOT NULL,
  created_by uuid NOT NULL,
  client_approved boolean NOT NULL DEFAULT false,
  provider_approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
  CONSTRAINT brief_versions_pkey PRIMARY KEY (id),
  CONSTRAINT brief_versions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT brief_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.shoot_rooms (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shoot_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT shoot_rooms_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.room_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  room_id uuid,
  sender_id uuid,
  text text NOT NULL,
  storage_path text,
  type text NOT NULL DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'image'::text, 'system'::text])),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  conversation_id uuid,
  submission_id uuid,
  CONSTRAINT room_messages_pkey PRIMARY KEY (id),
  CONSTRAINT room_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT room_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.shoot_rooms(id),
  CONSTRAINT room_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.room_decisions (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  room_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  proposed_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'proposed'::text CHECK (status = ANY (ARRAY['proposed'::text, 'agreed'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT room_decisions_pkey PRIMARY KEY (id),
  CONSTRAINT room_decisions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.shoot_rooms(id),
  CONSTRAINT room_decisions_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.room_milestones (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  room_id uuid NOT NULL,
  title text NOT NULL,
  due_at timestamp with time zone,
  status text NOT NULL DEFAULT 'todo'::text CHECK (status = ANY (ARRAY['todo'::text, 'done'::text])),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT room_milestones_pkey PRIMARY KEY (id),
  CONSTRAINT room_milestones_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id),
  CONSTRAINT room_milestones_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.shoot_rooms(id),
  CONSTRAINT room_milestones_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.galleries (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'open_for_selection'::text, 'selection_submitted'::text, 'finalized'::text])),
  round integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  revision_requested_at timestamp with time zone,
  CONSTRAINT galleries_pkey PRIMARY KEY (id),
  CONSTRAINT galleries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.gallery_images (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  gallery_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  caption text NOT NULL DEFAULT ''::text,
  provenance USER-DEFINED NOT NULL DEFAULT 'captured'::provenance,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  similarity_group_key text,
  CONSTRAINT gallery_images_pkey PRIMARY KEY (id),
  CONSTRAINT gallery_images_gallery_id_fkey FOREIGN KEY (gallery_id) REFERENCES public.galleries(id)
);
CREATE TABLE public.gallery_selections (
  gallery_id uuid NOT NULL,
  image_id uuid NOT NULL,
  round integer NOT NULL,
  selected_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gallery_selections_pkey PRIMARY KEY (gallery_id, image_id, round),
  CONSTRAINT gallery_selections_gallery_id_fkey FOREIGN KEY (gallery_id) REFERENCES public.galleries(id),
  CONSTRAINT gallery_selections_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.gallery_images(id),
  CONSTRAINT gallery_selections_selected_by_fkey FOREIGN KEY (selected_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  selection_round integer CHECK (selection_round > 0),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid NOT NULL UNIQUE,
  author_id uuid NOT NULL,
  photographer_id uuid,
  studio_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT ''::text,
  is_hidden boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  moderation_reason text,
  reassessment_requested_at timestamp with time zone,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id),
  CONSTRAINT reviews_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id)
);
CREATE TABLE public.content_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  outcome text CHECK (outcome = ANY (ARRAY['actioned'::text, 'dismissed'::text])),
  CONSTRAINT content_reports_pkey PRIMARY KEY (id),
  CONSTRAINT content_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ai_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ai_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.creative_projects(id),
  CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ai_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  project_id uuid,
  user_id uuid NOT NULL,
  kind USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'queued'::job_status,
  input jsonb NOT NULL,
  result jsonb,
  error text,
  request_key uuid NOT NULL UNIQUE,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  provider_started_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.creative_projects(id),
  CONSTRAINT ai_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ai_artifacts (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  project_id uuid NOT NULL,
  job_id uuid NOT NULL UNIQUE,
  storage_path text NOT NULL UNIQUE,
  provenance USER-DEFINED NOT NULL,
  original_image_id uuid,
  prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_artifacts_pkey PRIMARY KEY (id),
  CONSTRAINT ai_artifacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.creative_projects(id),
  CONSTRAINT ai_artifacts_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id),
  CONSTRAINT ai_artifacts_original_image_id_fkey FOREIGN KEY (original_image_id) REFERENCES public.gallery_images(id)
);
CREATE TABLE public.image_embeddings (
  image_id uuid NOT NULL,
  description text NOT NULL,
  model text NOT NULL,
  embedding USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT image_embeddings_pkey PRIMARY KEY (image_id),
  CONSTRAINT image_embeddings_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.portfolio_images(id)
);
CREATE TABLE public.ai_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  user_id uuid NOT NULL,
  job_id uuid,
  feature text NOT NULL,
  model text NOT NULL,
  reserved_usd numeric NOT NULL CHECK (reserved_usd >= 0::numeric),
  actual_usd numeric CHECK (actual_usd IS NULL OR actual_usd >= 0::numeric),
  status text NOT NULL DEFAULT 'reserved'::text CHECK (status = ANY (ARRAY['reserved'::text, 'completed'::text, 'uncertain'::text, 'released'::text])),
  image_count integer NOT NULL DEFAULT 0,
  input_tokens integer,
  output_tokens integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_pkey PRIMARY KEY (id),
  CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT ai_usage_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id)
);
CREATE TABLE public.ai_actions (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  project_id uuid NOT NULL,
  proposed_for uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['update_brief'::text, 'create_milestone'::text, 'request_booking'::text, 'reschedule_booking'::text, 'assign_photographer'::text])),
  explanation text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed'::text CHECK (status = ANY (ARRAY['proposed'::text, 'applied'::text, 'rejected'::text])),
  project_version integer NOT NULL,
  booking_version integer,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:15:00'::interval),
  applied_by uuid,
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_actions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_actions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.creative_projects(id),
  CONSTRAINT ai_actions_proposed_for_fkey FOREIGN KEY (proposed_for) REFERENCES public.profiles(id),
  CONSTRAINT ai_actions_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.dataset_studio_sets (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  request_id uuid NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 150),
  description text NOT NULL DEFAULT ''::text CHECK (length(description) <= 10000),
  genre USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT dataset_studio_sets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dataset_studio_set_images (
  image_id uuid NOT NULL,
  set_id uuid NOT NULL,
  sort_order integer NOT NULL,
  CONSTRAINT dataset_studio_set_images_pkey PRIMARY KEY (image_id),
  CONSTRAINT dataset_studio_set_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.portfolio_images(id),
  CONSTRAINT dataset_studio_set_images_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.dataset_studio_sets(id)
);
CREATE TABLE public.dataset_image_rejections (
  fingerprint text NOT NULL CHECK (fingerprint ~ '^(pixel|sha256):[a-f0-9]{64}$'::text),
  reason text NOT NULL DEFAULT 'deleted'::text CHECK (reason = ANY (ARRAY['deleted'::text, 'legacy_orphan'::text])),
  CONSTRAINT dataset_image_rejections_pkey PRIMARY KEY (fingerprint)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  client_id uuid NOT NULL,
  photographer_id uuid,
  studio_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id),
  CONSTRAINT conversations_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id),
  CONSTRAINT conversations_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  recipient_id uuid NOT NULL,
  booking_id uuid,
  studio_id uuid,
  event text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT notifications_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id)
);
CREATE TABLE public.booking_cancellations (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  booking_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  is_client_proposal boolean NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'::text CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'declined'::text, 'expired'::text])),
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT booking_cancellations_pkey PRIMARY KEY (id),
  CONSTRAINT booking_cancellations_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_cancellations_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.profiles(id),
  CONSTRAINT booking_cancellations_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.photo_feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v7(),
  image_id uuid NOT NULL,
  round integer NOT NULL CHECK (round > 0),
  author_id uuid NOT NULL,
  note text NOT NULL CHECK (length(btrim(note)) >= 1 AND length(btrim(note)) <= 1000),
  x double precision,
  y double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT photo_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT photo_feedback_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.gallery_images(id),
  CONSTRAINT photo_feedback_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.booking_add_ons (
  booking_id uuid NOT NULL,
  add_on_id uuid NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  CONSTRAINT booking_add_ons_pkey PRIMARY KEY (booking_id, add_on_id),
  CONSTRAINT booking_add_ons_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_add_ons_add_on_id_fkey FOREIGN KEY (add_on_id) REFERENCES public.service_add_ons(id)
);