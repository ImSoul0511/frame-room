set search_path = public, extensions;

create function private.reserve_booking(bid uuid, starts timestamptz, ends timestamptz, assignee uuid, resources uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings; rid uuid; begin
 select * into strict b from public.bookings where id=bid for update;
 if starts>=ends or ends-starts>interval '24 hours' then raise exception 'invalid_interval' using errcode='23514'; end if;
 if b.studio_id is null then
  if cardinality(resources)>0 or (assignee is not null and assignee<>b.photographer_id) then raise exception 'invalid_assignment' using errcode='23514'; end if;
  assignee=b.photographer_id;
 elsif assignee is null or not exists(select 1 from public.studio_members m join public.photographers p on p.user_id=m.user_id where m.studio_id=b.studio_id and p.id=assignee) then
  raise exception 'invalid_assignment' using errcode='23514';
 end if;
 if exists(select 1 from unnest(resources) r where not exists(select 1 from public.studio_resources where id=r and studio_id=b.studio_id and is_active and deleted_at is null)) then
  raise exception 'invalid_resource' using errcode='23514'; end if;
 if cardinality(resources)<>(select count(distinct r) from unnest(resources) r) then raise exception 'duplicate_resource' using errcode='23514'; end if;
 delete from public.schedule_entries where booking_id=bid;
 insert into public.schedule_entries(booking_id,photographer_id,during,label) values(bid,assignee,tstzrange(starts,ends,'[)'),b.service_name);
 delete from public.booking_resources where booking_id=bid;
 foreach rid in array resources loop
  insert into public.schedule_entries(booking_id,resource_id,during,label) values(bid,rid,tstzrange(starts,ends,'[)'),b.service_name);
  insert into public.booking_resources select bid,id,name,type from public.studio_resources where id=rid;
 end loop;
 update public.bookings set scheduled_start=starts,scheduled_end=ends,assigned_photographer_id=assignee where id=bid;
end $$;

create function public.frameroom_transition(bid uuid, desired public.booking_status, expected_version integer, reason text default '', starts timestamptz default null, ends timestamptz default null, assignee uuid default null, resources uuid[] default '{}')
returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings; is_provider boolean; is_client boolean; rid uuid; begin
 select * into b from public.bookings where id=bid for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 is_provider=private.provider_side(bid); is_client=b.client_id=auth.uid();
 if not (is_provider or is_client) then raise exception 'forbidden' using errcode='42501'; end if;
 if expected_version<>b.version then raise exception 'stale_version' using errcode='40001'; end if;
 if desired='confirmed' and b.status='pending' and (private.owns_provider(b.photographer_id,b.studio_id)) then
  if not private.provider_visible(b.photographer_id,b.studio_id) then raise exception 'provider_unavailable' using errcode='23514'; end if;
  perform private.reserve_booking(bid,coalesce(starts,b.scheduled_start),coalesce(ends,b.scheduled_end),coalesce(assignee,b.assigned_photographer_id),resources);
  insert into public.shoot_rooms(booking_id) values(bid) returning id into rid;
  insert into public.galleries(booking_id) values(bid);
 elsif desired='rejected' and b.status='pending' and private.owns_provider(b.photographer_id,b.studio_id) then null;
 elsif desired='cancelled' and ((b.status='pending' and is_client) or (b.status='confirmed' and (is_client or is_provider)) or (b.status='in_progress' and is_provider)) then
  delete from public.schedule_entries where booking_id=bid;
  update public.shoot_rooms set status='closed' where booking_id=bid;
 elsif desired='in_progress' and b.status='confirmed' and is_provider then
  if b.agreed_brief_version is null then raise exception 'brief_required' using errcode='23514'; end if;
 elsif desired='proofing' and b.status='in_progress' and is_provider then
  if not exists(select 1 from public.gallery_images i join public.galleries g on g.id=i.gallery_id where g.booking_id=bid) then raise exception 'gallery_required' using errcode='23514'; end if;
  update public.galleries set status='open_for_selection' where booking_id=bid;
 elsif desired='delivered' and b.status='proofing' and is_provider then
  if not exists(select 1 from public.galleries where booking_id=bid and status='selection_submitted') or not exists(select 1 from public.deliveries where booking_id=bid) then raise exception 'selection_delivery_required' using errcode='23514'; end if;
  update public.galleries set status='finalized' where booking_id=bid;
 elsif desired='completed' and b.status='delivered' and is_client then
  update public.shoot_rooms set status='closed' where booking_id=bid;
 else raise exception 'invalid_transition' using errcode='23514'; end if;
 update public.bookings set status=desired,version=version+1 where id=bid returning * into b;
 insert into public.room_messages(room_id,sender_id,text,type)
 select id,auth.uid(),desired::text || case when reason<>'' then ': '||reason else '' end,'system' from public.shoot_rooms where booking_id=bid;
 return b;
end $$;

create function public.frameroom_reschedule(bid uuid, expected_version integer, starts timestamptz, ends timestamptz, assignee uuid default null, resources uuid[] default '{}')
returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings; begin
 select * into strict b from public.bookings where id=bid for update;
 if not private.owns_provider(b.photographer_id,b.studio_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if b.version<>expected_version then raise exception 'stale_version' using errcode='40001'; end if;
 if b.status not in ('confirmed','in_progress') then raise exception 'invalid_transition' using errcode='23514'; end if;
 perform private.reserve_booking(bid,starts,ends,coalesce(assignee,b.assigned_photographer_id),resources);
 update public.bookings set version=version+1 where id=bid returning * into b;
 insert into public.room_messages(room_id,sender_id,text,type) select id,auth.uid(),'schedule_updated','system' from public.shoot_rooms where booking_id=bid;
 return b;
end $$;

create function private.prevent_assigned_departure() returns trigger language plpgsql set search_path='' as $$ begin
 perform 1 from public.studios where id=old.studio_id for update;
 if exists(select 1 from public.bookings b join public.photographers p on p.id=b.assigned_photographer_id where b.studio_id=old.studio_id and p.user_id=old.user_id and b.status not in ('rejected','cancelled','completed')) then
  raise exception 'active_assignment' using errcode='23514'; end if; return old;
end $$;
create trigger prevent_assigned_departure before delete on public.studio_members for each row execute function private.prevent_assigned_departure();

create function private.check_schedule_consistency() returns trigger language plpgsql set search_path='' as $$
declare bid uuid; b public.bookings; begin
 if tg_table_name='bookings' then bid=coalesce(new.id,old.id); else bid=coalesce(new.booking_id,old.booking_id); end if;
 if bid is null then return null; end if;
 select * into b from public.bookings where id=bid;
 if b.status in ('confirmed','in_progress','proofing','delivered','completed') then
  if (select count(*) from public.schedule_entries where booking_id=bid and photographer_id=b.assigned_photographer_id and during=tstzrange(b.scheduled_start,b.scheduled_end,'[)'))<>1 then
   raise exception 'schedule_inconsistent' using errcode='23514'; end if;
  if exists(select 1 from public.booking_resources r where r.booking_id=bid and not exists(select 1 from public.schedule_entries e where e.booking_id=bid and e.resource_id=r.resource_id and e.during=tstzrange(b.scheduled_start,b.scheduled_end,'[)'))) then raise exception 'resource_inconsistent' using errcode='23514'; end if;
 elsif b.status in ('pending','rejected','cancelled') and exists(select 1 from public.schedule_entries where booking_id=bid) then
  raise exception 'schedule_inconsistent' using errcode='23514'; end if;
 return null;
end $$;
create constraint trigger bookings_schedule_check after insert or update on public.bookings deferrable initially deferred for each row execute function private.check_schedule_consistency();
create constraint trigger entries_schedule_check after insert or update or delete on public.schedule_entries deferrable initially deferred for each row execute function private.check_schedule_consistency();

-- Persisted budget reservation serializes across API and worker processes.
create function public.frameroom_reserve_usage(uid uuid, feature_name text, model_name text, reserve_amount numeric, images integer, monthly_limit numeric default 30)
returns uuid language plpgsql security definer set search_path='' as $$
declare total numeric; image_total integer; usage_id uuid; begin
 perform pg_advisory_xact_lock(7342001);
 select coalesce(sum(case when status='released' then 0 else greatest(coalesce(actual_usd,0),reserved_usd) end),0),coalesce(sum(case when status='released' then 0 else image_count end),0)
 into total,image_total from public.ai_usage where created_at>=date_trunc('month',now());
 if reserve_amount<=0 or reserve_amount>30 or monthly_limit>30 or total+reserve_amount>monthly_limit or image_total+images>100 then raise exception 'ai_budget_exhausted' using errcode='P0001'; end if;
 if (select count(*) from public.ai_usage where user_id=uid and created_at>now()-interval '1 day' and status<>'released')>=30 then raise exception 'ai_daily_limit' using errcode='P0001'; end if;
 insert into public.ai_usage(user_id,feature,model,reserved_usd,image_count) values(uid,feature_name,model_name,reserve_amount,images) returning id into usage_id;
 return usage_id;
end $$;

-- pgmq is available in the pinned local Supabase PostgreSQL image.
create extension if not exists pgmq;
select pgmq.create('frameroom_ai');
create function public.frameroom_enqueue_job(job_id uuid) returns void language sql security definer set search_path='' as $$
 select pgmq.send('frameroom_ai',jsonb_build_object('jobId',job_id)); $$;
create function public.frameroom_claim_jobs() returns table(msg_id bigint,message jsonb) language sql security definer set search_path='' as $$
 select msg_id,message from pgmq.read('frameroom_ai',300,1); $$;
create function public.frameroom_archive_job(message_id bigint) returns void language sql security definer set search_path='' as $$
 select pgmq.archive('frameroom_ai',message_id); $$;

-- Never expose privileged mutators through authenticated PostgREST RPC.
revoke all on function private.reserve_booking(uuid,timestamptz,timestamptz,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.frameroom_transition(uuid,public.booking_status,integer,text,timestamptz,timestamptz,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.frameroom_reschedule(uuid,integer,timestamptz,timestamptz,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.frameroom_reserve_usage(uuid,text,text,numeric,integer,numeric),public.frameroom_enqueue_job(uuid),public.frameroom_claim_jobs(),public.frameroom_archive_job(bigint) from public,anon,authenticated;
grant execute on function public.frameroom_transition(uuid,public.booking_status,integer,text,timestamptz,timestamptz,uuid,uuid[]),public.frameroom_reschedule(uuid,integer,timestamptz,timestamptz,uuid,uuid[]),public.frameroom_reserve_usage(uuid,text,text,numeric,integer,numeric),public.frameroom_enqueue_job(uuid),public.frameroom_claim_jobs(),public.frameroom_archive_job(bigint) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('avatars','avatars',true,2097152,array['image/webp']),
 ('profile-covers','profile-covers',true,2097152,array['image/webp']),
 ('portfolio-images','portfolio-images',true,2097152,array['image/webp']),
 ('gallery-previews','gallery-previews',false,2097152,array['image/webp']),
 ('brief-references','brief-references',false,2097152,array['image/webp']),
 ('room-files','room-files',false,2097152,array['image/webp']),
 ('search-uploads','search-uploads',false,2097152,array['image/webp']),
 ('ai-artifacts','ai-artifacts',false,5242880,array['image/webp']),
 ('deliveries','deliveries',false,20971520,array['image/jpeg','image/png','image/webp']);

create function private.storage_read(bucket text,path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare rid uuid; begin
 if auth.uid() is null then return false; end if;
 if bucket in ('brief-references','search-uploads') then
  if split_part(path,'/',1)=auth.uid()::text then return true; end if;
  return bucket='brief-references' and exists(select 1 from public.creative_projects where path=any(reference_paths) and private.can_read_project(id));
 elsif bucket='ai-artifacts' then return exists(select 1 from public.ai_artifacts where storage_path=path and private.can_read_project(project_id));
 elsif bucket='gallery-previews' then return exists(select 1 from public.gallery_images i join public.galleries g on g.id=i.gallery_id where (i.storage_path=path or replace(i.storage_path,'.webp','_thumb.webp')=path) and private.can_read_gallery(g.id));
 elsif bucket='deliveries' then return exists(select 1 from public.deliveries d join public.bookings b on b.id=d.booking_id where d.storage_path=path and private.can_read_booking(b.id) and (b.status in ('delivered','completed') or private.provider_side(b.id)));
 elsif bucket='room-files' then
  begin rid=split_part(path,'/',1)::uuid; exception when invalid_text_representation then return false; end;
  return private.can_read_room(rid);
 end if; return false;
end $$;
revoke all on function private.storage_read(text,text) from public;
grant execute on function private.storage_read(text,text) to authenticated,service_role;
create policy private_media_read on storage.objects for select to authenticated using(private.storage_read(bucket_id,name));
create policy owned_media_insert on storage.objects for insert to authenticated with check(
 bucket_id in ('avatars','profile-covers','portfolio-images','brief-references','search-uploads') and split_part(name,'/',1)=auth.uid()::text
);
-- Gallery, room, delivery, and generated assets are written only by the API after authorization.

alter publication supabase_realtime add table public.room_messages,public.room_decisions,public.room_milestones,public.ai_jobs;

insert into public.tags(slug,name,kind) values
 ('warm','Warm','tone'),('cool','Cool','tone'),('neutral','Neutral','tone'),
 ('studio','Studio','setting'),('outdoor','Outdoor','setting'),('window-light','Window light','setting'),
 ('cinematic','Cinematic','mood'),('natural','Natural','mood'),('editorial','Editorial','mood');
