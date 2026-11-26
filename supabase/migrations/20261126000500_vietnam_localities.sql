
create table public.vietnam_localities (
  id text primary key,
  label_vi text not null unique,
  label_en text not null,
  aliases text[] not null
);
alter table public.vietnam_localities enable row level security;
revoke all on public.vietnam_localities from public, anon, authenticated;
grant all on public.vietnam_localities to service_role;

insert into public.vietnam_localities (id,label_vi,label_en,aliases) values
  ('an-giang','An Giang','An Giang',array['an giang','kien giang']),
  ('bac-ninh','Bắc Ninh','Bac Ninh',array['bac ninh','bac giang']),
  ('ca-mau','Cà Mau','Ca Mau',array['ca mau','bac lieu']),
  ('cao-bang','Cao Bằng','Cao Bang',array['cao bang']),
  ('can-tho','Cần Thơ','Can Tho',array['can tho','soc trang','hau giang']),
  ('da-nang','Đà Nẵng','Da Nang',array['da nang','quang nam']),
  ('dak-lak','Đắk Lắk','Dak Lak',array['dak lak','phu yen']),
  ('dien-bien','Điện Biên','Dien Bien',array['dien bien']),
  ('dong-nai','Đồng Nai','Dong Nai',array['dong nai','binh phuoc']),
  ('dong-thap','Đồng Tháp','Dong Thap',array['dong thap','tien giang']),
  ('gia-lai','Gia Lai','Gia Lai',array['gia lai','binh dinh']),
  ('ha-noi','Hà Nội','Hanoi',array['ha noi','hanoi']),
  ('ha-tinh','Hà Tĩnh','Ha Tinh',array['ha tinh']),
  ('hai-phong','Hải Phòng','Hai Phong',array['hai phong','hai duong']),
  ('ho-chi-minh','Hồ Chí Minh','Ho Chi Minh City',array['ho chi minh','ho chi minh city','thanh pho ho chi minh','tp ho chi minh','binh duong','ba ria vung tau','hcmc','saigon','sai gon']),
  ('hue','Huế','Hue',array['hue','thua thien hue']),
  ('hung-yen','Hưng Yên','Hung Yen',array['hung yen','thai binh']),
  ('khanh-hoa','Khánh Hòa','Khanh Hoa',array['khanh hoa','ninh thuan']),
  ('lai-chau','Lai Châu','Lai Chau',array['lai chau']),
  ('lam-dong','Lâm Đồng','Lam Dong',array['lam dong','dak nong','binh thuan']),
  ('lang-son','Lạng Sơn','Lang Son',array['lang son']),
  ('lao-cai','Lào Cai','Lao Cai',array['lao cai','yen bai']),
  ('nghe-an','Nghệ An','Nghe An',array['nghe an']),
  ('ninh-binh','Ninh Bình','Ninh Binh',array['ninh binh','ha nam','nam dinh']),
  ('phu-tho','Phú Thọ','Phu Tho',array['phu tho','vinh phuc','hoa binh']),
  ('quang-ngai','Quảng Ngãi','Quang Ngai',array['quang ngai','kon tum']),
  ('quang-ninh','Quảng Ninh','Quang Ninh',array['quang ninh']),
  ('quang-tri','Quảng Trị','Quang Tri',array['quang tri','quang binh']),
  ('son-la','Sơn La','Son La',array['son la']),
  ('tay-ninh','Tây Ninh','Tay Ninh',array['tay ninh','long an']),
  ('thai-nguyen','Thái Nguyên','Thai Nguyen',array['thai nguyen','bac kan']),
  ('thanh-hoa','Thanh Hóa','Thanh Hoa',array['thanh hoa']),
  ('tuyen-quang','Tuyên Quang','Tuyen Quang',array['tuyen quang','ha giang']),
  ('vinh-long','Vĩnh Long','Vinh Long',array['vinh long','ben tre','tra vinh']);

create function private.normalize_locality(value text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(translate(regexp_replace(normalize(lower(value), NFD),
    U&'[\0300-\036F]', '', 'g'), 'đ', 'd'), '[^a-z0-9]+', ' ', 'g'));
$$;

create function private.find_locality(value text) returns text
language sql stable security definer set search_path = '' as $$
  select id from public.vietnam_localities l
  where private.normalize_locality(value) = any(l.aliases)
     or regexp_replace(private.normalize_locality(value),'^(thanh pho|tinh) ','') = any(l.aliases)
  order by id limit 1;
$$;

alter table public.photographers add column locality_id text references public.vietnam_localities(id);
alter table public.studios add column locality_id text references public.vietnam_localities(id);
update public.photographers set locality_id=private.find_locality(city);
update public.studios set locality_id=private.find_locality(city);
update public.photographers p set city=l.label_vi from public.vietnam_localities l where p.locality_id=l.id and p.city<>l.label_vi;
update public.studios s set city=l.label_vi from public.vietnam_localities l where s.locality_id=l.id and s.city<>l.label_vi;

create function private.canonical_provider_locality() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.city is not distinct from old.city and new.locality_id is not distinct from old.locality_id then
    return new;
  end if;
  new.locality_id := private.find_locality(new.city);
  if new.locality_id is null then
    if btrim(new.city)<>'' then raise exception 'invalid_locality' using errcode='23514'; end if;
  else
    select label_vi into new.city from public.vietnam_localities where id=new.locality_id;
  end if;
  return new;
end;
$$;
revoke all on function private.find_locality(text), private.canonical_provider_locality() from public;
create trigger photographer_locality before insert or update of city,locality_id on public.photographers
  for each row execute function private.canonical_provider_locality();
create trigger studio_locality before insert or update of city,locality_id on public.studios
  for each row execute function private.canonical_provider_locality();

