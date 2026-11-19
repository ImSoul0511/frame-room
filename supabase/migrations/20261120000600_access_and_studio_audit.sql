alter function private.storage_read(text,text) rename to storage_read_legacy;
revoke all on function private.storage_read_legacy(text,text) from anon, authenticated, service_role;

create function private.storage_read(bucket text, path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if bucket in ('room-files','conversation-files') then
    return exists (
      select 1 from public.room_messages m
      where (m.storage_path=path or replace(m.storage_path,'.webp','_thumb.webp')=path)
        and ((bucket='room-files' and m.room_id is not null)
          or (bucket='conversation-files' and m.room_id is null))
        and private.can_read_conversation_message(m.id)
    );
  elsif bucket='deliveries' then
    return exists (
      select 1 from public.deliveries d join public.bookings b on b.id=d.booking_id
      join public.galleries g on g.booking_id=b.id and g.round=d.selection_round
      where d.storage_path=path and private.can_read_booking(b.id)
        and (b.status in ('delivered','completed') or private.provider_side(b.id))
    );
  end if;
  return private.storage_read_legacy(bucket,path);
end;
$$;
revoke all on function private.storage_read(text,text) from public, anon;
grant execute on function private.storage_read(text,text) to authenticated,service_role;
drop policy private_media_read on storage.objects;
create policy private_media_read on storage.objects for select to authenticated
  using (private.storage_read(bucket_id,name));

drop policy photo_feedback_read on public.photo_feedback;
create policy photo_feedback_read on public.photo_feedback for select to authenticated
  using (exists (
    select 1 from public.gallery_images i join public.galleries g on g.id=i.gallery_id
    where i.id=image_id and private.can_read_gallery(g.id)
      and (author_id=auth.uid() or g.round>photo_feedback.round or g.status<>'open_for_selection')
  ));

create table private.studio_events (
  id uuid primary key default public.uuid_generate_v7(),
  studio_id uuid not null references public.studios(id),
  actor_id uuid references public.profiles(id),
  member_id uuid not null references public.profiles(id),
  event text not null,
  previous_value text,
  next_value text,
  created_at timestamptz not null default now()
);
create index idx_studio_events_studio on private.studio_events(studio_id,created_at);
alter table private.studio_events enable row level security;
revoke all on private.studio_events from public, anon, authenticated;

create function private.audit_studio_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare studio uuid; member_user uuid; before_value text; after_value text;
begin
  if tg_op <> 'DELETE' then
    studio := new.studio_id;
    member_user := new.user_id;
    after_value := new.role::text;
  end if;
  if tg_op <> 'INSERT' then
    studio := old.studio_id;
    member_user := old.user_id;
    before_value := old.role::text;
  end if;
  if after_value is distinct from before_value then
    insert into private.studio_events(studio_id,actor_id,member_id,event,previous_value,next_value)
      values(studio,auth.uid(),member_user,'membership',before_value,after_value);
    if member_user is distinct from auth.uid() then
      insert into public.notifications(recipient_id,studio_id,event)
        values(member_user,studio,'membershipUpdated');
    end if;
  end if;
  return null;
end;
$$;
create trigger audit_studio_membership after insert or update of role or delete on public.studio_members
  for each row execute function private.audit_studio_membership();

create function private.audit_studio_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid; previous_status text; notification_user uuid; notification_event text;
begin
  select user_id into strict recipient from public.photographers where id=new.photographer_id;
  if tg_op = 'INSERT' then
    notification_user := recipient;
    notification_event := 'newInvitation';
  else
    previous_status := old.status::text;
    if new.status = old.status then return null; end if;
    notification_user := new.invited_by;
    notification_event := 'invitationUpdated';
  end if;
  insert into private.studio_events(studio_id,actor_id,member_id,event,previous_value,next_value)
    values(new.studio_id,auth.uid(),recipient,'invitation',previous_status,new.status::text);
  if notification_user is distinct from auth.uid() then
    insert into public.notifications(recipient_id,studio_id,event)
      values(notification_user,new.studio_id,notification_event);
  end if;
  return null;
end;
$$;
create trigger audit_studio_invitation after insert or update of status on public.studio_invitations
  for each row execute function private.audit_studio_invitation();
