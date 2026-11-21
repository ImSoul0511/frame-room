create table public.booking_add_ons (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  add_on_id uuid not null references public.service_add_ons(id),
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  primary key (booking_id, add_on_id)
);

alter table public.booking_add_ons enable row level security;
revoke all on public.booking_add_ons from public, anon, authenticated;
grant select on public.booking_add_ons to authenticated;
grant all on public.booking_add_ons to service_role;

create policy booking_add_ons_read on public.booking_add_ons
  for select to authenticated
  using (private.can_read_booking(booking_id));