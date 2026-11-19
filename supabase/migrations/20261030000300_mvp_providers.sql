create view public.providers with (security_invoker=true) as
select p.id,'photographer'::text as type,p.display_name,p.bio,p.city,p.district,p.genres,p.styles,
 (select min(price) from public.services s where s.photographer_id=p.id and is_active and deleted_at is null) as price_from,
 (select round(avg(rating),1)::float from public.reviews r where r.photographer_id=p.id and not is_hidden and deleted_at is null) as rating_avg,
 (select count(*)::int from public.reviews r where r.photographer_id=p.id and not is_hidden and deleted_at is null) as review_count
from public.photographers p where not p.is_hidden
union all
select s.id,'studio'::text,s.name,s.description,s.city,s.district,s.genres,'{}'::text[],
 (select min(price) from public.services v where v.studio_id=s.id and is_active and deleted_at is null),
 (select round(avg(rating),1)::float from public.reviews r where r.studio_id=s.id and not is_hidden and deleted_at is null),
 (select count(*)::int from public.reviews r where r.studio_id=s.id and not is_hidden and deleted_at is null)
from public.studios s where not s.is_hidden and s.deleted_at is null;
grant select on public.providers to anon,authenticated,service_role;
