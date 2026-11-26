import type { Transaction } from '../repositories/database.js';
import { manageProvider } from './access.js';

type ProviderType = 'photographer' | 'studio';

export async function availability(
  tx: Transaction,
  type: ProviderType,
  id: string,
  crewSize: number,
) {
  const photographer = type === 'photographer';
  const table = photographer ? 'photographers' : 'studios';
  const { availabilityPublic } = await tx.one<{ availabilityPublic: boolean }>(
    `select availability_public from ${table} where id=$1 and not is_hidden
      and private.provider_visible(${photographer ? 'id,null' : 'null,id'})`,
    [id],
  );
  if (!availabilityPublic) return { availabilityPublic, slots: [] };
  const slots = await tx.rows<{ start: string; end: string; available: boolean }>(
    `with crew as (
      ${
        photographer
          ? 'select id from photographers where id=$1'
          : 'select p.id from studio_members m join photographers p on m.user_id=p.user_id where m.studio_id=$1 and not p.is_hidden'
      }
    ), windows as (
      select starts at time zone 'Asia/Ho_Chi_Minh' as start_at,
        (starts+interval '2 hours') at time zone 'Asia/Ho_Chi_Minh' as end_at
      from generate_series(
        date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh'),
        date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') + interval '6 days',
        interval '1 day'
      ) days(day_at) cross join lateral (
        select day_at + make_interval(hours=>hour_at) as starts
        from unnest(array[9,11,13,15]) hour_slots(hour_at)
      ) hours
    )
    select start_at as start,end_at as "end",
      (select count(*) from crew where not exists (
        select 1 from schedule_entries e where e.photographer_id=crew.id
        and e.during && tstzrange(start_at,end_at,'[)')
      )) >= $2 as available from windows where start_at>now() order by start_at`,
    [id, crewSize],
  );
  return { availabilityPublic, slots };
}

export async function availabilitySetting(
  tx: Transaction,
  type: ProviderType,
  id: string,
  value?: boolean,
) {
  const photographer = type === 'photographer';
  await manageProvider(tx, photographer ? id : null, photographer ? null : id);
  const table = photographer ? 'photographers' : 'studios';
  return value === undefined
    ? tx.one<{ availabilityPublic: boolean }>(
        `select availability_public from ${table} where id=$1`,
        [id],
      )
    : tx.one<{ availabilityPublic: boolean }>(
        `update ${table} set availability_public=$2 where id=$1 returning availability_public`,
        [id, value],
      );
}
