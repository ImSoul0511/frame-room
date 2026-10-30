-- Completed billed calls use Gateway-reported cost; in-flight/unknown calls retain reservations.
create or replace function public.frameroom_reserve_usage(uid uuid, feature_name text, model_name text, reserve_amount numeric, images integer, monthly_limit numeric default 30)
returns uuid language plpgsql security definer set search_path='' as $$
declare total numeric; image_total integer; usage_id uuid; begin
 perform pg_advisory_xact_lock(7342001);
 select coalesce(sum(case when status='released' then 0 when status='completed' and actual_usd is not null then actual_usd else reserved_usd end),0),coalesce(sum(case when status='released' then 0 else image_count end),0)
 into total,image_total from public.ai_usage where created_at>=date_trunc('month',now());
 if reserve_amount<=0 or reserve_amount>30 or monthly_limit<=0 or monthly_limit>30 or images<0 or total+reserve_amount>monthly_limit or image_total+images>100 then raise exception 'ai_budget_exhausted' using errcode='P0001'; end if;
 if (select count(*) from public.ai_usage where user_id=uid and created_at>now()-interval '1 day' and status<>'released')>=30 then raise exception 'ai_daily_limit' using errcode='P0001'; end if;
 insert into public.ai_usage(user_id,feature,model,reserved_usd,image_count) values(uid,feature_name,model_name,reserve_amount,images) returning id into usage_id;
 return usage_id;
end $$;
revoke all on function public.frameroom_reserve_usage(uuid,text,text,numeric,integer,numeric) from public,anon,authenticated;
grant execute on function public.frameroom_reserve_usage(uuid,text,text,numeric,integer,numeric) to service_role;
alter table public.ai_usage add constraint chk_actual_usd_nonnegative check(actual_usd is null or actual_usd>=0);
