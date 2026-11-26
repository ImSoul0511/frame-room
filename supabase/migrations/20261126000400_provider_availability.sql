alter table public.photographers add column availability_public boolean not null default false;
alter table public.studios add column availability_public boolean not null default false;
