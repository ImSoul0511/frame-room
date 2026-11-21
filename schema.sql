


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'rejected',
    'cancelled',
    'in_progress',
    'proofing',
    'delivered',
    'completed'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."genre" AS ENUM (
    'portrait',
    'fashion',
    'wedding',
    'family',
    'product',
    'food',
    'event',
    'cosplay'
);


ALTER TYPE "public"."genre" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'revoked'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."job_kind" AS ENUM (
    'concept',
    'edit',
    'cull',
    'index'
);


ALTER TYPE "public"."job_kind" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'uncertain'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."portfolio_status" AS ENUM (
    'draft',
    'published',
    'hidden'
);


ALTER TYPE "public"."portfolio_status" OWNER TO "postgres";


CREATE TYPE "public"."provenance" AS ENUM (
    'captured',
    'manipulated',
    'ai_generated'
);


ALTER TYPE "public"."provenance" OWNER TO "postgres";


CREATE TYPE "public"."provider_type" AS ENUM (
    'photographer',
    'studio'
);


ALTER TYPE "public"."provider_type" OWNER TO "postgres";


CREATE TYPE "public"."resource_type" AS ENUM (
    'room',
    'equipment'
);


ALTER TYPE "public"."resource_type" OWNER TO "postgres";


CREATE TYPE "public"."studio_member_role" AS ENUM (
    'manager',
    'photographer'
);


ALTER TYPE "public"."studio_member_role" OWNER TO "postgres";


CREATE TYPE "public"."tag_kind" AS ENUM (
    'tone',
    'setting',
    'mood'
);


ALTER TYPE "public"."tag_kind" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uuid_generate_v7"() RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare h text := lpad(to_hex(floor(extract(epoch from clock_timestamp()) * 1000)::bigint),12,'0');
r text := encode(extensions.gen_random_bytes(10),'hex');
begin
  return (h || '7' || substr(r,1,3) || substr('89ab',1+(get_byte(decode(substr(r,4,2),'hex'),0)%4),1) || substr(r,6,15))::uuid;
end $$;


ALTER FUNCTION "public"."uuid_generate_v7"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "owner_type" "public"."provider_type" NOT NULL,
    "photographer_id" "uuid",
    "studio_id" "uuid",
    "assigned_photographer_id" "uuid",
    "status" "public"."booking_status" DEFAULT 'pending'::"public"."booking_status" NOT NULL,
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone NOT NULL,
    "total_price" integer NOT NULL,
    "service_name" "text" NOT NULL,
    "service_snapshot" "jsonb" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "agreed_brief_version" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completion_due_at" timestamp with time zone,
    "completion_hold_at" timestamp with time zone,
    "completion_remaining_ms" integer,
    "conversation_id" "uuid",
    "request_key" "uuid",
    CONSTRAINT "bookings_check" CHECK (("scheduled_end" > "scheduled_start")),
    CONSTRAINT "bookings_check1" CHECK (((("owner_type" = 'photographer'::"public"."provider_type") AND ("photographer_id" IS NOT NULL) AND ("studio_id" IS NULL)) OR (("owner_type" = 'studio'::"public"."provider_type") AND ("studio_id" IS NOT NULL) AND ("photographer_id" IS NULL)))),
    CONSTRAINT "bookings_completion_state_check" CHECK (((("status" = 'delivered'::"public"."booking_status") OR (("completion_due_at" IS NULL) AND ("completion_hold_at" IS NULL))) AND ((("completion_hold_at" IS NULL) AND ("completion_remaining_ms" IS NULL)) OR (("completion_hold_at" IS NOT NULL) AND ("completion_due_at" IS NULL) AND ("completion_remaining_ms" IS NOT NULL) AND (("completion_remaining_ms" >= 0) AND ("completion_remaining_ms" <= 604800000)))))),
    CONSTRAINT "bookings_total_price_check" CHECK (("total_price" >= 0))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_archive_job"("message_id" bigint) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select pgmq.archive('frameroom_ai',message_id); $$;


ALTER FUNCTION "public"."frameroom_archive_job"("message_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_claim_jobs"() RETURNS TABLE("msg_id" bigint, "message" "jsonb")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select msg_id,message from pgmq.read('frameroom_ai',300,1); $$;


ALTER FUNCTION "public"."frameroom_claim_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_complete_due_bookings"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  booking_id_to_complete uuid;
  completed_count integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for booking_id_to_complete in
    select id from public.bookings
    where status = 'delivered' and completion_hold_at is null
      and completion_due_at <= statement_timestamp()
    order by completion_due_at, id
    limit 100 for update skip locked
  loop
    update public.bookings set status = 'completed', version = version + 1
      where id = booking_id_to_complete;
    update public.shoot_rooms set status = 'closed'
      where booking_id = booking_id_to_complete;
    insert into public.room_messages (room_id, sender_id, text, type)
      select id, null, 'completed', 'system' from public.shoot_rooms
      where booking_id = booking_id_to_complete;
    completed_count := completed_count + 1;
  end loop;
  return completed_count;
end;
$$;


ALTER FUNCTION "public"."frameroom_complete_due_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_enqueue_job"("job_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select pgmq.send('frameroom_ai',jsonb_build_object('jobId',job_id)); $$;


ALTER FUNCTION "public"."frameroom_enqueue_job"("job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_reschedule"("bid" "uuid", "expected_version" integer, "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid" DEFAULT NULL::"uuid", "resources" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "public"."bookings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare b public.bookings;
begin
  select * into strict b from public.bookings where id = bid for update;
  if not private.owns_provider(b.photographer_id,b.studio_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.version <> expected_version then raise exception 'stale_version' using errcode = '40001'; end if;
  if b.status not in ('confirmed','in_progress') then
    raise exception 'invalid_transition' using errcode = '23514';
  end if;
  if assignee is not null and assignee is distinct from b.assigned_photographer_id then
    raise exception 'invalid_assignment' using errcode = '23514';
  end if;
  if starts is distinct from b.scheduled_start or ends is distinct from b.scheduled_end then
    raise exception 'brief_required' using errcode = '23514';
  end if;
  perform private.reserve_booking(bid, starts, ends, b.assigned_photographer_id, resources);
  update public.bookings set version = version + 1 where id = bid returning * into b;
  insert into public.room_messages(room_id,sender_id,text,type)
    select id, auth.uid(), 'schedule_updated', 'system' from public.shoot_rooms where booking_id = bid;
  return b;
end;
$$;


ALTER FUNCTION "public"."frameroom_reschedule"("bid" "uuid", "expected_version" integer, "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid", "resources" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_reserve_usage"("uid" "uuid", "feature_name" "text", "model_name" "text", "reserve_amount" numeric, "images" integer, "monthly_limit" numeric DEFAULT 30) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare total numeric; image_total integer; usage_id uuid; begin
 perform pg_advisory_xact_lock(7342001);
 select coalesce(sum(case when status='released' then 0 when status='completed' and actual_usd is not null then actual_usd else reserved_usd end),0),coalesce(sum(case when status='released' then 0 else image_count end),0)
 into total,image_total from public.ai_usage where created_at>=date_trunc('month',now());
 if reserve_amount<=0 or reserve_amount>30 or monthly_limit<=0 or monthly_limit>30 or images<0 or total+reserve_amount>monthly_limit or image_total+images>100 then raise exception 'ai_budget_exhausted' using errcode='P0001'; end if;
 if (select count(*) from public.ai_usage where user_id=uid and created_at>now()-interval '1 day' and status<>'released')>=100 then raise exception 'ai_daily_limit' using errcode='P0001'; end if;
 insert into public.ai_usage(user_id,feature,model,reserved_usd,image_count) values(uid,feature_name,model_name,reserve_amount,images) returning id into usage_id;
 return usage_id;
end $$;


ALTER FUNCTION "public"."frameroom_reserve_usage"("uid" "uuid", "feature_name" "text", "model_name" "text", "reserve_amount" numeric, "images" integer, "monthly_limit" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_set_completion_hold"("p_booking_id" "uuid", "p_hold" boolean, "p_version" integer, "p_reason" "text") RETURNS "public"."bookings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  b public.bookings;
  event_at timestamptz;
  remaining_ms integer;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_hold is null or p_version is null or coalesce(length(btrim(p_reason)), 0) not between 1 and 1000 then
    raise exception 'invalid_hold_request' using errcode = '22023';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if b.status <> 'delivered' or (b.completion_due_at is null and b.completion_hold_at is null) then
    raise exception 'completion_hold_unavailable' using errcode = '23514';
  end if;
  if p_hold = (b.completion_hold_at is not null) then
    return b;
  end if;
  if p_version <> b.version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  event_at := pg_catalog.clock_timestamp();
  if p_hold then
    if b.completion_due_at <= event_at then
      raise exception 'completion_hold_unavailable' using errcode = '23514';
    end if;
    remaining_ms := least(604800000, ceil(extract(epoch from (b.completion_due_at - event_at)) * 1000));
    update public.bookings
      set completion_due_at = null, completion_hold_at = event_at,
          completion_remaining_ms = remaining_ms, version = version + 1
      where id = b.id returning * into b;
  else
    remaining_ms := b.completion_remaining_ms;
    update public.bookings
      set completion_due_at = event_at + remaining_ms * interval '1 millisecond',
          completion_hold_at = null, completion_remaining_ms = null, version = version + 1
      where id = b.id returning * into b;
  end if;
  insert into private.booking_completion_events
    (booking_id, event, actor_id, occurred_at, due_at, remaining_ms, reason)
  values (b.id, case when p_hold then 'held' else 'resumed' end,
          auth.uid(), event_at, b.completion_due_at, remaining_ms, btrim(p_reason));
  return b;
end;
$$;


ALTER FUNCTION "public"."frameroom_set_completion_hold"("p_booking_id" "uuid", "p_hold" boolean, "p_version" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."frameroom_transition"("bid" "uuid", "desired" "public"."booking_status", "expected_version" integer, "reason" "text" DEFAULT ''::"text", "starts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "ends" timestamp with time zone DEFAULT NULL::timestamp with time zone, "assignee" "uuid" DEFAULT NULL::"uuid", "resources" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "public"."bookings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  b public.bookings;
  latest public.brief_versions;
begin
  select * into strict b from public.bookings where id = bid for update;
  if auth.uid() is null or not (private.provider_side(bid) or b.client_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.version <> expected_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if desired in ('rejected', 'cancelled') and coalesce(length(btrim(reason)), 0) = 0 then
    raise exception 'reason_required' using errcode = '23514';
  end if;
  if desired = 'cancelled' and b.status <> 'pending' then
    raise exception 'mutual_cancellation_required' using errcode = '23514';
  end if;
  if desired = 'confirmed' and b.status = 'pending' then
    if not private.owns_provider(b.photographer_id,b.studio_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select * into latest from public.brief_versions where booking_id = bid order by version desc limit 1;
    if not found or latest.status <> 'open' or not latest.client_approved or not latest.provider_approved then
      raise exception 'brief_required' using errcode = '23514';
    end if;
    if b.scheduled_start <= now() or (starts is not null and starts <> b.scheduled_start)
      or (ends is not null and ends <> b.scheduled_end) then
      raise exception 'invalid_interval' using errcode = '23514';
    end if;
    if b.assigned_photographer_id is null
      or (assignee is not null and assignee <> b.assigned_photographer_id) then
      raise exception 'invalid_assignment' using errcode = '23514';
    end if;
    if not exists (select 1 from public.photographers where id=b.assigned_photographer_id and not is_hidden) then
      raise exception 'invalid_assignment' using errcode = '23514';
    end if;
    update public.bookings set agreed_brief_version = latest.version where id = bid;
  end if;
  if desired = 'delivered' then
    update public.booking_cancellations set status = 'expired', decided_at = now()
      where booking_id = bid and status = 'proposed';
  end if;
  b := private.frameroom_transition(bid, desired, expected_version, reason, starts, ends, assignee, resources);
  insert into private.booking_events(booking_id, actor_id, event, details)
  values (bid, auth.uid(), desired::text, jsonb_build_object('reason', reason, 'briefVersion', b.agreed_brief_version));
  return b;
end;
$$;


ALTER FUNCTION "public"."frameroom_transition"("bid" "uuid", "desired" "public"."booking_status", "expected_version" integer, "reason" "text", "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid", "resources" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_actions" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "proposed_for" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "explanation" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "project_version" integer NOT NULL,
    "booking_version" integer,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "applied_by" "uuid",
    "applied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_actions_kind_check" CHECK (("kind" = ANY (ARRAY['update_brief'::"text", 'create_milestone'::"text", 'request_booking'::"text", 'reschedule_booking'::"text", 'assign_photographer'::"text"]))),
    CONSTRAINT "ai_actions_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'applied'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ai_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_artifacts" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "provenance" "public"."provenance" NOT NULL,
    "original_image_id" "uuid",
    "prompt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_jobs" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "kind" "public"."job_kind" NOT NULL,
    "status" "public"."job_status" DEFAULT 'queued'::"public"."job_status" NOT NULL,
    "input" "jsonb" NOT NULL,
    "result" "jsonb",
    "error" "text",
    "request_key" "uuid" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "provider_started_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "feature" "text" NOT NULL,
    "model" "text" NOT NULL,
    "reserved_usd" numeric(12,6) NOT NULL,
    "actual_usd" numeric(12,6),
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "image_count" integer DEFAULT 0 NOT NULL,
    "input_tokens" integer,
    "output_tokens" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_usage_reserved_usd_check" CHECK (("reserved_usd" >= (0)::numeric)),
    CONSTRAINT "ai_usage_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'completed'::"text", 'uncertain'::"text", 'released'::"text"]))),
    CONSTRAINT "chk_actual_usd_nonnegative" CHECK ((("actual_usd" IS NULL) OR ("actual_usd" >= (0)::numeric)))
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_add_ons" (
    "booking_id" "uuid" NOT NULL,
    "add_on_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" integer NOT NULL,
    CONSTRAINT "booking_add_ons_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "booking_add_ons_unit_price_check" CHECK (("unit_price" >= 0))
);


ALTER TABLE "public"."booking_add_ons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_cancellations" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "proposed_by" "uuid" NOT NULL,
    "is_client_proposal" boolean NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_cancellations_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."booking_cancellations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_resources" (
    "booking_id" "uuid" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."resource_type" NOT NULL
);


ALTER TABLE "public"."booking_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brief_versions" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "content" "jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "client_approved" boolean DEFAULT false NOT NULL,
    "provider_approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    CONSTRAINT "chk_brief_version_status" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."brief_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "outcome" "text",
    CONSTRAINT "content_reports_outcome_check" CHECK (("outcome" = ANY (ARRAY['actioned'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "content_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "photographer_id" "uuid",
    "studio_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_conversation_provider" CHECK (("num_nonnulls"("photographer_id", "studio_id") = 1))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creative_projects" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "idea" "text" NOT NULL,
    "brief" "jsonb",
    "reference_paths" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selected_artifact_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    CONSTRAINT "chk_selected_artifact_limit" CHECK (("cardinality"("selected_artifact_ids") <= 12))
);


ALTER TABLE "public"."creative_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selection_round" integer,
    CONSTRAINT "deliveries_mime_type_check" CHECK (("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "deliveries_selection_round_check" CHECK (("selection_round" > 0))
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."galleries" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "round" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revision_requested_at" timestamp with time zone,
    CONSTRAINT "galleries_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open_for_selection'::"text", 'selection_submitted'::"text", 'finalized'::"text"])))
);


ALTER TABLE "public"."galleries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gallery_images" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "gallery_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "caption" "text" DEFAULT ''::"text" NOT NULL,
    "provenance" "public"."provenance" DEFAULT 'captured'::"public"."provenance" NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gallery_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gallery_selections" (
    "gallery_id" "uuid" NOT NULL,
    "image_id" "uuid" NOT NULL,
    "round" integer NOT NULL,
    "selected_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gallery_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_embeddings" (
    "image_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "model" "text" NOT NULL,
    "embedding" "extensions"."vector"(768) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."image_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_tags" (
    "portfolio_image_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "confidence" real,
    CONSTRAINT "image_tags_confidence_check" CHECK ((("confidence" >= (0)::double precision) AND ("confidence" <= (1)::double precision))),
    CONSTRAINT "image_tags_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."image_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "studio_id" "uuid",
    "event" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photo_feedback" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "image_id" "uuid" NOT NULL,
    "round" integer NOT NULL,
    "author_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "x" double precision,
    "y" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_photo_feedback_position" CHECK ((("num_nonnulls"("x", "y") = 0) OR (("num_nonnulls"("x", "y") = 2) AND (("x" >= (0)::double precision) AND ("x" <= (1)::double precision)) AND (("y" >= (0)::double precision) AND ("y" <= (1)::double precision))))),
    CONSTRAINT "photo_feedback_note_check" CHECK ((("length"("btrim"("note")) >= 1) AND ("length"("btrim"("note")) <= 1000))),
    CONSTRAINT "photo_feedback_round_check" CHECK (("round" > 0))
);


ALTER TABLE "public"."photo_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photographers" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text" DEFAULT ''::"text" NOT NULL,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "district" "text" DEFAULT ''::"text" NOT NULL,
    "genres" "public"."genre"[] NOT NULL,
    "styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    "professional_roles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "photographers_display_name_check" CHECK ((("length"("display_name") >= 1) AND ("length"("display_name") <= 60))),
    CONSTRAINT "photographers_genres_check" CHECK ((("cardinality"("genres") >= 1) AND ("cardinality"("genres") <= 5))),
    CONSTRAINT "photographers_professional_roles_check" CHECK (("professional_roles" <@ ARRAY['photographer'::"text", 'retoucher'::"text", 'art_director'::"text"]))
);


ALTER TABLE "public"."photographers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolio_images" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "caption" "text" DEFAULT ''::"text" NOT NULL,
    "provenance" "public"."provenance" DEFAULT 'captured'::"public"."provenance" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "source" "text",
    "collected_at" timestamp with time zone,
    "license_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "crew_credits" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "portfolio_images_height_check" CHECK ((("height" >= 1) AND ("height" <= 1280))),
    CONSTRAINT "portfolio_images_width_check" CHECK ((("width" >= 1) AND ("width" <= 1280)))
);


ALTER TABLE "public"."portfolio_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolios" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "owner_type" "public"."provider_type" NOT NULL,
    "photographer_id" "uuid",
    "studio_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "genre" "public"."genre" NOT NULL,
    "status" "public"."portfolio_status" DEFAULT 'draft'::"public"."portfolio_status" NOT NULL,
    "published_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "portfolios_check" CHECK (((("owner_type" = 'photographer'::"public"."provider_type") AND ("photographer_id" IS NOT NULL) AND ("studio_id" IS NULL)) OR (("owner_type" = 'studio'::"public"."provider_type") AND ("studio_id" IS NOT NULL) AND ("photographer_id" IS NULL))))
);


ALTER TABLE "public"."portfolios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_display_name_check" CHECK ((("length"("display_name") >= 1) AND ("length"("display_name") <= 60))),
    CONSTRAINT "profiles_user_name_check" CHECK (("user_name" ~ '^[a-z0-9][a-z0-9_]{2,29}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "photographer_id" "uuid",
    "studio_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text" DEFAULT ''::"text" NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "moderation_reason" "text",
    "reassessment_requested_at" timestamp with time zone,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "owner_type" "public"."provider_type" NOT NULL,
    "photographer_id" "uuid",
    "studio_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "genre" "public"."genre" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "price" integer NOT NULL,
    "photo_count" integer DEFAULT 10 NOT NULL,
    "retouched_count" integer DEFAULT 5 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selection_quota" integer,
    "revision_limit" integer,
    CONSTRAINT "services_check" CHECK (((("owner_type" = 'photographer'::"public"."provider_type") AND ("photographer_id" IS NOT NULL) AND ("studio_id" IS NULL)) OR (("owner_type" = 'studio'::"public"."provider_type") AND ("studio_id" IS NOT NULL) AND ("photographer_id" IS NULL)))),
    CONSTRAINT "services_duration_minutes_check" CHECK ((("duration_minutes" >= 15) AND ("duration_minutes" <= 1440))),
    CONSTRAINT "services_photo_count_check" CHECK (("photo_count" >= 0)),
    CONSTRAINT "services_price_check" CHECK (("price" >= 0)),
    CONSTRAINT "services_retouched_count_check" CHECK (("retouched_count" >= 0)),
    CONSTRAINT "services_revision_limit_check" CHECK ((("revision_limit" >= 0) AND ("revision_limit" <= 100))),
    CONSTRAINT "services_selection_quota_check" CHECK ((("selection_quota" >= 1) AND ("selection_quota" <= 200)))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studios" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "district" "text" DEFAULT ''::"text" NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "genres" "public"."genre"[] NOT NULL,
    "created_by" "uuid" NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    CONSTRAINT "studios_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 80)))
);


ALTER TABLE "public"."studios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."providers" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    'photographer'::"text" AS "type",
    "p"."display_name",
    "p"."bio",
    "p"."city",
    "p"."district",
    ("p"."genres")::"text"[] AS "genres",
    "p"."styles",
    ( SELECT "min"("s"."price") AS "min"
           FROM "public"."services" "s"
          WHERE (("s"."photographer_id" = "p"."id") AND "s"."is_active" AND ("s"."deleted_at" IS NULL))) AS "price_from",
    ( SELECT ("round"("avg"("r"."rating"), 1))::double precision AS "round"
           FROM "public"."reviews" "r"
          WHERE (("r"."photographer_id" = "p"."id") AND (NOT "r"."is_hidden") AND ("r"."deleted_at" IS NULL))) AS "rating_avg",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."reviews" "r"
          WHERE (("r"."photographer_id" = "p"."id") AND (NOT "r"."is_hidden") AND ("r"."deleted_at" IS NULL))) AS "review_count"
   FROM "public"."photographers" "p"
  WHERE (NOT "p"."is_hidden")
UNION ALL
 SELECT "s"."id",
    'studio'::"text" AS "type",
    "s"."name" AS "display_name",
    "s"."description" AS "bio",
    "s"."city",
    "s"."district",
    ("s"."genres")::"text"[] AS "genres",
    '{}'::"text"[] AS "styles",
    ( SELECT "min"("v"."price") AS "min"
           FROM "public"."services" "v"
          WHERE (("v"."studio_id" = "s"."id") AND "v"."is_active" AND ("v"."deleted_at" IS NULL))) AS "price_from",
    ( SELECT ("round"("avg"("r"."rating"), 1))::double precision AS "round"
           FROM "public"."reviews" "r"
          WHERE (("r"."studio_id" = "s"."id") AND (NOT "r"."is_hidden") AND ("r"."deleted_at" IS NULL))) AS "rating_avg",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."reviews" "r"
          WHERE (("r"."studio_id" = "s"."id") AND (NOT "r"."is_hidden") AND ("r"."deleted_at" IS NULL))) AS "review_count"
   FROM "public"."studios" "s"
  WHERE ((NOT "s"."is_hidden") AND ("s"."deleted_at" IS NULL));


ALTER VIEW "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_decisions" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "proposed_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_decisions_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'agreed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."room_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_messages" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "room_id" "uuid",
    "sender_id" "uuid",
    "text" "text" NOT NULL,
    "storage_path" "text",
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conversation_id" "uuid",
    "submission_id" "uuid",
    CONSTRAINT "chk_message_context" CHECK ((("room_id" IS NOT NULL) OR ("conversation_id" IS NOT NULL))),
    CONSTRAINT "room_messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'image'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."room_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_milestones" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "due_at" timestamp with time zone,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "room_milestones_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."room_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_entries" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid",
    "photographer_id" "uuid",
    "resource_id" "uuid",
    "during" "tstzrange" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_entries_check" CHECK (("num_nonnulls"("photographer_id", "resource_id") = 1)),
    CONSTRAINT "schedule_entries_during_check" CHECK (((NOT "isempty"("during")) AND ("lower"("during") IS NOT NULL) AND ("upper"("during") IS NOT NULL) AND ("lower"("during") < "upper"("during")) AND "lower_inc"("during") AND (NOT "upper_inc"("during"))))
);


ALTER TABLE "public"."schedule_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_add_ons" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "price" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_add_ons_price_check" CHECK (("price" >= 0))
);


ALTER TABLE "public"."service_add_ons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shoot_rooms" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shoot_rooms_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."shoot_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studio_invitations" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "photographer_id" "uuid" NOT NULL,
    "role" "public"."studio_member_role" DEFAULT 'photographer'::"public"."studio_member_role" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."studio_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studio_members" (
    "studio_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."studio_member_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."studio_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."studio_resources" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "studio_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."resource_type" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."studio_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v7"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "kind" "public"."tag_kind" NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = 'system_admin'::"text"))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_actions"
    ADD CONSTRAINT "ai_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_request_key_key" UNIQUE ("request_key");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_add_ons"
    ADD CONSTRAINT "booking_add_ons_pkey" PRIMARY KEY ("booking_id", "add_on_id");



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_resources"
    ADD CONSTRAINT "booking_resources_pkey" PRIMARY KEY ("booking_id", "resource_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."brief_versions"
    ADD CONSTRAINT "brief_versions_booking_id_version_key" UNIQUE ("booking_id", "version");



ALTER TABLE ONLY "public"."brief_versions"
    ADD CONSTRAINT "brief_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creative_projects"
    ADD CONSTRAINT "creative_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."galleries"
    ADD CONSTRAINT "galleries_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."galleries"
    ADD CONSTRAINT "galleries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gallery_images"
    ADD CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gallery_images"
    ADD CONSTRAINT "gallery_images_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."gallery_selections"
    ADD CONSTRAINT "gallery_selections_pkey" PRIMARY KEY ("gallery_id", "image_id", "round");



ALTER TABLE ONLY "public"."image_embeddings"
    ADD CONSTRAINT "image_embeddings_pkey" PRIMARY KEY ("image_id");



ALTER TABLE ONLY "public"."image_tags"
    ADD CONSTRAINT "image_tags_pkey" PRIMARY KEY ("portfolio_image_id", "tag_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_feedback"
    ADD CONSTRAINT "photo_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photographers"
    ADD CONSTRAINT "photographers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photographers"
    ADD CONSTRAINT "photographers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."portfolio_images"
    ADD CONSTRAINT "portfolio_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portfolio_images"
    ADD CONSTRAINT "portfolio_images_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_name_key" UNIQUE ("user_name");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_decisions"
    ADD CONSTRAINT "room_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_milestones"
    ADD CONSTRAINT "room_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_entries"
    ADD CONSTRAINT "schedule_entries_photographer_id_during_excl" EXCLUDE USING "gist" ("photographer_id" WITH =, "during" WITH &&) WHERE (("photographer_id" IS NOT NULL));



ALTER TABLE ONLY "public"."schedule_entries"
    ADD CONSTRAINT "schedule_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_entries"
    ADD CONSTRAINT "schedule_entries_resource_id_during_excl" EXCLUDE USING "gist" ("resource_id" WITH =, "during" WITH &&) WHERE (("resource_id" IS NOT NULL));



ALTER TABLE ONLY "public"."service_add_ons"
    ADD CONSTRAINT "service_add_ons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shoot_rooms"
    ADD CONSTRAINT "shoot_rooms_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."shoot_rooms"
    ADD CONSTRAINT "shoot_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studio_invitations"
    ADD CONSTRAINT "studio_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studio_members"
    ADD CONSTRAINT "studio_members_pkey" PRIMARY KEY ("studio_id", "user_id");



ALTER TABLE ONLY "public"."studio_resources"
    ADD CONSTRAINT "studio_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."studios"
    ADD CONSTRAINT "studios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "uq_booking_request" UNIQUE ("client_id", "request_key");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "uq_conversation_pair" UNIQUE NULLS NOT DISTINCT ("client_id", "photographer_id", "studio_id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "uq_message_submission" UNIQUE ("sender_id", "submission_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "bookings_completion_due_idx" ON "public"."bookings" USING "btree" ("completion_due_at", "id") WHERE (("status" = 'delivered'::"public"."booking_status") AND ("completion_hold_at" IS NULL) AND ("completion_due_at" IS NOT NULL));



CREATE INDEX "idx_actions_project" ON "public"."ai_actions" USING "btree" ("project_id");



CREATE INDEX "idx_ai_jobs_status" ON "public"."ai_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_ai_messages_project" ON "public"."ai_messages" USING "btree" ("project_id", "created_at");



CREATE INDEX "idx_ai_usage_user_daily" ON "public"."ai_usage" USING "btree" ("user_id", "created_at") WHERE ("status" <> 'released'::"text");



CREATE INDEX "idx_booking_add_ons_addon" ON "public"."booking_add_ons" USING "btree" ("add_on_id");



CREATE INDEX "idx_bookings_assignment" ON "public"."bookings" USING "btree" ("assigned_photographer_id", "studio_id");



CREATE INDEX "idx_bookings_client" ON "public"."bookings" USING "btree" ("client_id");



CREATE INDEX "idx_bookings_conversation" ON "public"."bookings" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversations_photographer" ON "public"."conversations" USING "btree" ("photographer_id");



CREATE INDEX "idx_conversations_studio" ON "public"."conversations" USING "btree" ("studio_id");



CREATE INDEX "idx_deliveries_booking_round" ON "public"."deliveries" USING "btree" ("booking_id", "selection_round");



CREATE INDEX "idx_gallery_images_gallery" ON "public"."gallery_images" USING "btree" ("gallery_id");



CREATE INDEX "idx_image_embeddings_hnsw" ON "public"."image_embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "idx_images_portfolio" ON "public"."portfolio_images" USING "btree" ("portfolio_id", "sort_order");



CREATE INDEX "idx_members_user" ON "public"."studio_members" USING "btree" ("user_id");



CREATE INDEX "idx_messages_room_cursor" ON "public"."room_messages" USING "btree" ("room_id", "created_at", "id");



CREATE INDEX "idx_notifications_recipient" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC, "id");



CREATE INDEX "idx_photo_feedback_image_round" ON "public"."photo_feedback" USING "btree" ("image_id", "round");



CREATE INDEX "idx_photographers_city" ON "public"."photographers" USING "btree" ("city", "district");



CREATE INDEX "idx_photographers_genres" ON "public"."photographers" USING "gin" ("genres");



CREATE INDEX "idx_portfolio_provider" ON "public"."portfolios" USING "btree" ("photographer_id", "studio_id", "status");



CREATE INDEX "idx_projects_owner" ON "public"."creative_projects" USING "btree" ("owner_id");



CREATE INDEX "idx_reviews_photographer_active" ON "public"."reviews" USING "btree" ("photographer_id") WHERE (("photographer_id" IS NOT NULL) AND (NOT "is_hidden") AND ("deleted_at" IS NULL));



CREATE INDEX "idx_reviews_reassessment" ON "public"."reviews" USING "btree" ("reassessment_requested_at", "id") WHERE ("reassessment_requested_at" IS NOT NULL);



CREATE INDEX "idx_reviews_studio_active" ON "public"."reviews" USING "btree" ("studio_id") WHERE (("studio_id" IS NOT NULL) AND (NOT "is_hidden") AND ("deleted_at" IS NULL));



CREATE INDEX "idx_room_messages_conversation_timeline" ON "public"."room_messages" USING "btree" ("conversation_id", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_schedule_entries_booking" ON "public"."schedule_entries" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "idx_service_add_ons_service" ON "public"."service_add_ons" USING "btree" ("service_id");



CREATE INDEX "idx_services_provider" ON "public"."services" USING "btree" ("photographer_id", "studio_id");



CREATE INDEX "idx_studios_city" ON "public"."studios" USING "btree" ("city", "district");



CREATE INDEX "idx_usage_month" ON "public"."ai_usage" USING "btree" ("created_at");



CREATE UNIQUE INDEX "uq_booking_open_cancellation" ON "public"."booking_cancellations" USING "btree" ("booking_id") WHERE ("status" = 'proposed'::"text");



CREATE UNIQUE INDEX "uq_pending_invitation" ON "public"."studio_invitations" USING "btree" ("studio_id", "photographer_id") WHERE ("status" = 'pending'::"public"."invitation_status");



CREATE OR REPLACE TRIGGER "audit_studio_invitation" AFTER INSERT OR UPDATE OF "status" ON "public"."studio_invitations" FOR EACH ROW EXECUTE FUNCTION "private"."audit_studio_invitation"();



CREATE OR REPLACE TRIGGER "audit_studio_membership" AFTER INSERT OR DELETE OR UPDATE OF "role" ON "public"."studio_members" FOR EACH ROW EXECUTE FUNCTION "private"."audit_studio_membership"();



CREATE CONSTRAINT TRIGGER "bookings_schedule_check" AFTER INSERT OR UPDATE ON "public"."bookings" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."check_schedule_consistency"();



CREATE CONSTRAINT TRIGGER "entries_schedule_check" AFTER INSERT OR DELETE OR UPDATE ON "public"."schedule_entries" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."check_schedule_consistency"();



CREATE OR REPLACE TRIGGER "link_bookings_to_conversation" AFTER INSERT ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "private"."link_bookings_to_conversation"();



CREATE OR REPLACE TRIGGER "notify_booking_status" AFTER INSERT OR UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "private"."notify_booking_status"();



CREATE OR REPLACE TRIGGER "prevent_assigned_departure" BEFORE DELETE ON "public"."studio_members" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_assigned_departure"();



CREATE CONSTRAINT TRIGGER "require_manager" AFTER INSERT OR DELETE OR UPDATE ON "public"."studio_members" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."require_manager"();



CREATE OR REPLACE TRIGGER "require_publishable_portfolio" BEFORE INSERT OR UPDATE OF "status" ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "private"."require_publishable_portfolio"();



CREATE OR REPLACE TRIGGER "set_booking_conversation" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "private"."set_booking_conversation"();



CREATE OR REPLACE TRIGGER "set_room_message_conversation" BEFORE INSERT ON "public"."room_messages" FOR EACH ROW EXECUTE FUNCTION "private"."set_room_message_conversation"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."ai_jobs" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."content_reports" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."creative_projects" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."galleries" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."image_embeddings" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."photographers" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."portfolio_images" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."room_decisions" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."room_milestones" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."service_add_ons" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."studio_invitations" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."studio_resources" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_updated_at" BEFORE UPDATE ON "public"."studios" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "track_booking_completion" BEFORE UPDATE OF "status" ON "public"."bookings" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "private"."track_booking_completion"();



CREATE OR REPLACE TRIGGER "validate_delivery_round" BEFORE UPDATE OF "status" ON "public"."bookings" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") AND ("new"."status" = 'delivered'::"public"."booking_status"))) EXECUTE FUNCTION "private"."validate_delivery_round"();



ALTER TABLE ONLY "public"."ai_actions"
    ADD CONSTRAINT "ai_actions_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ai_actions"
    ADD CONSTRAINT "ai_actions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."creative_projects"("id");



ALTER TABLE ONLY "public"."ai_actions"
    ADD CONSTRAINT "ai_actions_proposed_for_fkey" FOREIGN KEY ("proposed_for") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_original_image_id_fkey" FOREIGN KEY ("original_image_id") REFERENCES "public"."gallery_images"("id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."creative_projects"("id");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."creative_projects"("id");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."creative_projects"("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_add_ons"
    ADD CONSTRAINT "booking_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "public"."service_add_ons"("id");



ALTER TABLE ONLY "public"."booking_add_ons"
    ADD CONSTRAINT "booking_add_ons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_resources"
    ADD CONSTRAINT "booking_resources_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."booking_resources"
    ADD CONSTRAINT "booking_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."studio_resources"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_assigned_photographer_id_fkey" FOREIGN KEY ("assigned_photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."creative_projects"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."brief_versions"
    ADD CONSTRAINT "brief_versions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."brief_versions"
    ADD CONSTRAINT "brief_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."creative_projects"
    ADD CONSTRAINT "creative_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."galleries"
    ADD CONSTRAINT "galleries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."gallery_images"
    ADD CONSTRAINT "gallery_images_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id");



ALTER TABLE ONLY "public"."gallery_selections"
    ADD CONSTRAINT "gallery_selections_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id");



ALTER TABLE ONLY "public"."gallery_selections"
    ADD CONSTRAINT "gallery_selections_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."gallery_images"("id");



ALTER TABLE ONLY "public"."gallery_selections"
    ADD CONSTRAINT "gallery_selections_selected_by_fkey" FOREIGN KEY ("selected_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."image_embeddings"
    ADD CONSTRAINT "image_embeddings_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."portfolio_images"("id");



ALTER TABLE ONLY "public"."image_tags"
    ADD CONSTRAINT "image_tags_portfolio_image_id_fkey" FOREIGN KEY ("portfolio_image_id") REFERENCES "public"."portfolio_images"("id");



ALTER TABLE ONLY "public"."image_tags"
    ADD CONSTRAINT "image_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."photo_feedback"
    ADD CONSTRAINT "photo_feedback_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."photo_feedback"
    ADD CONSTRAINT "photo_feedback_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."gallery_images"("id");



ALTER TABLE ONLY "public"."photographers"
    ADD CONSTRAINT "photographers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."portfolio_images"
    ADD CONSTRAINT "portfolio_images_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."room_decisions"
    ADD CONSTRAINT "room_decisions_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."room_decisions"
    ADD CONSTRAINT "room_decisions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."shoot_rooms"("id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."shoot_rooms"("id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."room_milestones"
    ADD CONSTRAINT "room_milestones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."room_milestones"
    ADD CONSTRAINT "room_milestones_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."shoot_rooms"("id");



ALTER TABLE ONLY "public"."room_milestones"
    ADD CONSTRAINT "room_milestones_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedule_entries"
    ADD CONSTRAINT "schedule_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."schedule_entries"
    ADD CONSTRAINT "schedule_entries_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."schedule_entries"
    ADD CONSTRAINT "schedule_entries_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."studio_resources"("id");



ALTER TABLE ONLY "public"."service_add_ons"
    ADD CONSTRAINT "service_add_ons_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."shoot_rooms"
    ADD CONSTRAINT "shoot_rooms_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."studio_invitations"
    ADD CONSTRAINT "studio_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."studio_invitations"
    ADD CONSTRAINT "studio_invitations_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id");



ALTER TABLE ONLY "public"."studio_invitations"
    ADD CONSTRAINT "studio_invitations_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."studio_members"
    ADD CONSTRAINT "studio_members_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."studio_members"
    ADD CONSTRAINT "studio_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."studio_resources"
    ADD CONSTRAINT "studio_resources_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id");



ALTER TABLE ONLY "public"."studios"
    ADD CONSTRAINT "studios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "actions_read" ON "public"."ai_actions" FOR SELECT USING ((("proposed_for" = "auth"."uid"()) AND "private"."can_read_project"("project_id")));



CREATE POLICY "addons_read" ON "public"."service_add_ons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."services"
  WHERE ("services"."id" = "service_add_ons"."service_id"))));



ALTER TABLE "public"."ai_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_jobs_read" ON "public"."ai_jobs" FOR SELECT USING ((("user_id" = "auth"."uid"()) AND (("project_id" IS NULL) OR "private"."can_read_project"("project_id"))));



ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_messages_read" ON "public"."ai_messages" FOR SELECT USING ("private"."can_read_project"("project_id"));



ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "artifacts_read" ON "public"."ai_artifacts" FOR SELECT USING ("private"."can_read_project"("project_id"));



ALTER TABLE "public"."booking_add_ons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_add_ons_read" ON "public"."booking_add_ons" FOR SELECT TO "authenticated" USING ("private"."can_read_booking"("booking_id"));



ALTER TABLE "public"."booking_cancellations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_read" ON "public"."bookings" FOR SELECT USING ("private"."can_read_booking"("id"));



ALTER TABLE "public"."brief_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "briefs_read" ON "public"."brief_versions" FOR SELECT USING ("private"."can_read_booking"("booking_id"));



ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_messages_read" ON "public"."room_messages" FOR SELECT TO "authenticated" USING ("private"."can_read_conversation_message"("id"));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_read" ON "public"."conversations" FOR SELECT TO "authenticated" USING ("private"."can_read_conversation"("id"));



ALTER TABLE "public"."creative_projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "decisions_read" ON "public"."room_decisions" FOR SELECT USING ("private"."can_read_room"("room_id"));



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deliveries_read" ON "public"."deliveries" FOR SELECT USING (("private"."can_read_booking"("booking_id") AND (EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "deliveries"."booking_id") AND (("bookings"."status" = ANY (ARRAY['delivered'::"public"."booking_status", 'completed'::"public"."booking_status"])) OR "private"."provider_side"("bookings"."id")))))));



ALTER TABLE "public"."galleries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "galleries_read" ON "public"."galleries" FOR SELECT USING ("private"."can_read_gallery"("id"));



ALTER TABLE "public"."gallery_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gallery_images_read" ON "public"."gallery_images" FOR SELECT USING ("private"."can_read_gallery"("gallery_id"));



ALTER TABLE "public"."gallery_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "image_tags_read" ON "public"."image_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."portfolio_images"
  WHERE ("portfolio_images"."id" = "image_tags"."portfolio_image_id"))));



CREATE POLICY "images_read" ON "public"."portfolio_images" FOR SELECT USING ((((NOT "is_hidden") OR "private"."is_admin"()) AND (EXISTS ( SELECT 1
   FROM "public"."portfolios"
  WHERE ("portfolios"."id" = "portfolio_images"."portfolio_id")))));



CREATE POLICY "invitations_read" ON "public"."studio_invitations" FOR SELECT USING (("private"."is_manager"("studio_id") OR (EXISTS ( SELECT 1
   FROM "public"."photographers"
  WHERE (("photographers"."id" = "studio_invitations"."photographer_id") AND ("photographers"."user_id" = "auth"."uid"()))))));



CREATE POLICY "members_read" ON "public"."studio_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "private"."is_manager"("studio_id")));



CREATE POLICY "milestones_read" ON "public"."room_milestones" FOR SELECT USING ("private"."can_read_room"("room_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_read" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."photo_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "photo_feedback_read" ON "public"."photo_feedback" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."gallery_images" "i"
     JOIN "public"."galleries" "g" ON (("g"."id" = "i"."gallery_id")))
  WHERE (("i"."id" = "photo_feedback"."image_id") AND "private"."can_read_gallery"("g"."id") AND (("photo_feedback"."author_id" = "auth"."uid"()) OR ("g"."round" > "photo_feedback"."round") OR ("g"."status" <> 'open_for_selection'::"text"))))));



ALTER TABLE "public"."photographers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "photographers_read" ON "public"."photographers" FOR SELECT USING (((NOT "is_hidden") OR ("user_id" = "auth"."uid"()) OR "private"."is_admin"()));



ALTER TABLE "public"."portfolio_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portfolios_read" ON "public"."portfolios" FOR SELECT USING (((("status" = 'published'::"public"."portfolio_status") AND ("deleted_at" IS NULL) AND "private"."provider_visible"("photographer_id", "studio_id")) OR "private"."owns_provider"("photographer_id", "studio_id") OR "private"."is_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_read" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "projects_read" ON "public"."creative_projects" FOR SELECT USING ("private"."can_read_project"("id"));



CREATE POLICY "reports_read" ON "public"."content_reports" FOR SELECT USING ((("reporter_id" = "auth"."uid"()) OR "private"."is_admin"()));



CREATE POLICY "resources_read" ON "public"."studio_resources" FOR SELECT USING ("private"."is_manager"("studio_id"));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_read" ON "public"."reviews" FOR SELECT USING ((((NOT "is_hidden") AND ("deleted_at" IS NULL)) OR ("author_id" = "auth"."uid"()) OR "private"."is_admin"()));



CREATE POLICY "roles_read" ON "public"."user_roles" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."room_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_milestones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms_read" ON "public"."shoot_rooms" FOR SELECT TO "authenticated" USING ("private"."can_read_room"("id"));



ALTER TABLE "public"."schedule_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_read" ON "public"."schedule_entries" FOR SELECT USING (("private"."can_read_booking"("booking_id") OR "private"."owns_provider"("photographer_id", NULL::"uuid") OR (EXISTS ( SELECT 1
   FROM "public"."studio_resources"
  WHERE (("studio_resources"."id" = "schedule_entries"."resource_id") AND "private"."is_manager"("studio_resources"."studio_id"))))));



CREATE POLICY "selections_read" ON "public"."gallery_selections" FOR SELECT USING ("private"."can_read_gallery"("gallery_id"));



ALTER TABLE "public"."service_add_ons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_read" ON "public"."services" FOR SELECT USING ((("is_active" AND ("deleted_at" IS NULL) AND "private"."provider_visible"("photographer_id", "studio_id")) OR "private"."owns_provider"("photographer_id", "studio_id")));



ALTER TABLE "public"."shoot_rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "snapshots_read" ON "public"."booking_resources" FOR SELECT USING ("private"."can_read_booking"("booking_id"));



ALTER TABLE "public"."studio_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."studio_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."studio_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."studios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "studios_read" ON "public"."studios" FOR SELECT USING ((((NOT "is_hidden") AND ("deleted_at" IS NULL)) OR "private"."is_manager"("id") OR "private"."is_admin"()));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_read" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "usage_read" ON "public"."ai_usage" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "private"."is_admin"()));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."uuid_generate_v7"() TO "anon";
GRANT ALL ON FUNCTION "public"."uuid_generate_v7"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uuid_generate_v7"() TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "service_role";
GRANT SELECT ON TABLE "public"."bookings" TO "anon";
GRANT SELECT ON TABLE "public"."bookings" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."frameroom_archive_job"("message_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_archive_job"("message_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_claim_jobs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_claim_jobs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_complete_due_bookings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_complete_due_bookings"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_enqueue_job"("job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_enqueue_job"("job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_reschedule"("bid" "uuid", "expected_version" integer, "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid", "resources" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_reschedule"("bid" "uuid", "expected_version" integer, "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid", "resources" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_reserve_usage"("uid" "uuid", "feature_name" "text", "model_name" "text", "reserve_amount" numeric, "images" integer, "monthly_limit" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_reserve_usage"("uid" "uuid", "feature_name" "text", "model_name" "text", "reserve_amount" numeric, "images" integer, "monthly_limit" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_set_completion_hold"("p_booking_id" "uuid", "p_hold" boolean, "p_version" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_set_completion_hold"("p_booking_id" "uuid", "p_hold" boolean, "p_version" integer, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."frameroom_transition"("bid" "uuid", "desired" "public"."booking_status", "expected_version" integer, "reason" "text", "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid", "resources" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."frameroom_transition"("bid" "uuid", "desired" "public"."booking_status", "expected_version" integer, "reason" "text", "starts" timestamp with time zone, "ends" timestamp with time zone, "assignee" "uuid", "resources" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."ai_actions" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_actions" TO "anon";
GRANT SELECT ON TABLE "public"."ai_actions" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_artifacts" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_artifacts" TO "anon";
GRANT SELECT ON TABLE "public"."ai_artifacts" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_jobs" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_jobs" TO "anon";
GRANT SELECT ON TABLE "public"."ai_jobs" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_messages" TO "anon";
GRANT SELECT ON TABLE "public"."ai_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_usage" TO "anon";
GRANT SELECT ON TABLE "public"."ai_usage" TO "authenticated";



GRANT ALL ON TABLE "public"."booking_add_ons" TO "service_role";
GRANT SELECT ON TABLE "public"."booking_add_ons" TO "authenticated";



GRANT ALL ON TABLE "public"."booking_cancellations" TO "service_role";



GRANT ALL ON TABLE "public"."booking_resources" TO "service_role";
GRANT SELECT ON TABLE "public"."booking_resources" TO "anon";
GRANT SELECT ON TABLE "public"."booking_resources" TO "authenticated";



GRANT ALL ON TABLE "public"."brief_versions" TO "service_role";
GRANT SELECT ON TABLE "public"."brief_versions" TO "anon";
GRANT SELECT ON TABLE "public"."brief_versions" TO "authenticated";



GRANT ALL ON TABLE "public"."content_reports" TO "service_role";
GRANT SELECT ON TABLE "public"."content_reports" TO "anon";
GRANT SELECT ON TABLE "public"."content_reports" TO "authenticated";



GRANT ALL ON TABLE "public"."conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."conversations" TO "authenticated";



GRANT ALL ON TABLE "public"."creative_projects" TO "service_role";
GRANT SELECT ON TABLE "public"."creative_projects" TO "anon";
GRANT SELECT ON TABLE "public"."creative_projects" TO "authenticated";



GRANT ALL ON TABLE "public"."deliveries" TO "service_role";
GRANT SELECT ON TABLE "public"."deliveries" TO "anon";
GRANT SELECT ON TABLE "public"."deliveries" TO "authenticated";



GRANT ALL ON TABLE "public"."galleries" TO "service_role";
GRANT SELECT ON TABLE "public"."galleries" TO "anon";
GRANT SELECT ON TABLE "public"."galleries" TO "authenticated";



GRANT ALL ON TABLE "public"."gallery_images" TO "service_role";
GRANT SELECT ON TABLE "public"."gallery_images" TO "anon";
GRANT SELECT ON TABLE "public"."gallery_images" TO "authenticated";



GRANT ALL ON TABLE "public"."gallery_selections" TO "service_role";
GRANT SELECT ON TABLE "public"."gallery_selections" TO "anon";
GRANT SELECT ON TABLE "public"."gallery_selections" TO "authenticated";



GRANT ALL ON TABLE "public"."image_embeddings" TO "service_role";
GRANT SELECT ON TABLE "public"."image_embeddings" TO "anon";
GRANT SELECT ON TABLE "public"."image_embeddings" TO "authenticated";



GRANT ALL ON TABLE "public"."image_tags" TO "service_role";
GRANT SELECT ON TABLE "public"."image_tags" TO "anon";
GRANT SELECT ON TABLE "public"."image_tags" TO "authenticated";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."photo_feedback" TO "service_role";
GRANT SELECT ON TABLE "public"."photo_feedback" TO "authenticated";



GRANT ALL ON TABLE "public"."photographers" TO "service_role";
GRANT SELECT ON TABLE "public"."photographers" TO "anon";
GRANT SELECT ON TABLE "public"."photographers" TO "authenticated";



GRANT ALL ON TABLE "public"."portfolio_images" TO "service_role";
GRANT SELECT ON TABLE "public"."portfolio_images" TO "anon";
GRANT SELECT ON TABLE "public"."portfolio_images" TO "authenticated";



GRANT ALL ON TABLE "public"."portfolios" TO "service_role";
GRANT SELECT ON TABLE "public"."portfolios" TO "anon";
GRANT SELECT ON TABLE "public"."portfolios" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "anon";
GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."reviews" TO "anon";
GRANT SELECT ON TABLE "public"."reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."services" TO "service_role";
GRANT SELECT ON TABLE "public"."services" TO "anon";
GRANT SELECT ON TABLE "public"."services" TO "authenticated";



GRANT ALL ON TABLE "public"."studios" TO "service_role";
GRANT SELECT ON TABLE "public"."studios" TO "anon";
GRANT SELECT ON TABLE "public"."studios" TO "authenticated";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."room_decisions" TO "service_role";
GRANT SELECT ON TABLE "public"."room_decisions" TO "anon";
GRANT SELECT ON TABLE "public"."room_decisions" TO "authenticated";



GRANT ALL ON TABLE "public"."room_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."room_messages" TO "anon";
GRANT SELECT ON TABLE "public"."room_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."room_milestones" TO "service_role";
GRANT SELECT ON TABLE "public"."room_milestones" TO "anon";
GRANT SELECT ON TABLE "public"."room_milestones" TO "authenticated";



GRANT ALL ON TABLE "public"."schedule_entries" TO "service_role";
GRANT SELECT ON TABLE "public"."schedule_entries" TO "anon";
GRANT SELECT ON TABLE "public"."schedule_entries" TO "authenticated";



GRANT ALL ON TABLE "public"."service_add_ons" TO "service_role";
GRANT SELECT ON TABLE "public"."service_add_ons" TO "anon";
GRANT SELECT ON TABLE "public"."service_add_ons" TO "authenticated";



GRANT ALL ON TABLE "public"."shoot_rooms" TO "service_role";
GRANT SELECT ON TABLE "public"."shoot_rooms" TO "anon";
GRANT SELECT ON TABLE "public"."shoot_rooms" TO "authenticated";



GRANT ALL ON TABLE "public"."studio_invitations" TO "service_role";
GRANT SELECT ON TABLE "public"."studio_invitations" TO "anon";
GRANT SELECT ON TABLE "public"."studio_invitations" TO "authenticated";



GRANT ALL ON TABLE "public"."studio_members" TO "service_role";
GRANT SELECT ON TABLE "public"."studio_members" TO "anon";
GRANT SELECT ON TABLE "public"."studio_members" TO "authenticated";



GRANT ALL ON TABLE "public"."studio_resources" TO "service_role";
GRANT SELECT ON TABLE "public"."studio_resources" TO "anon";
GRANT SELECT ON TABLE "public"."studio_resources" TO "authenticated";



GRANT ALL ON TABLE "public"."tags" TO "service_role";
GRANT SELECT ON TABLE "public"."tags" TO "anon";
GRANT SELECT ON TABLE "public"."tags" TO "authenticated";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







