import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { v7 as uuidv7 } from 'uuid';
import { loadEnv } from './config/env.js';
import { Database } from './repositories/database.js';
import { MediaService, thumbnailPath } from './services/media.js';

const env = loadEnv();
if (
  !env.SUPABASE_SERVICE_ROLE_KEY ||
  !env.DATABASE_URL ||
  new URL(env.SUPABASE_URL).hostname !== '127.0.0.1' ||
  new URL(env.DATABASE_URL).hostname !== '127.0.0.1'
)
  throw new Error('Demo seeding is restricted to configured local Supabase.');
const auth = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const db = new Database(env.DATABASE_URL);
const media = new MediaService(env);
const password = 'FrameRoom-Demo-2026!';
const people = [
  { email: 'client@frameroom.test', name: 'Demo Client', username: 'demo_client' },
  {
    email: 'photographer@frameroom.test',
    name: 'Linh Nguyen',
    username: 'demo_linh',
    genre: 'portrait',
  },
  { email: 'manager@frameroom.test', name: 'Minh Tran', username: 'demo_minh', genre: 'fashion' },
  { email: 'food@frameroom.test', name: 'Mai Pham', username: 'demo_mai', genre: 'food' },
  { email: 'wedding@frameroom.test', name: 'An Le', username: 'demo_an', genre: 'wedding' },
  { email: 'product@frameroom.test', name: 'Bao Vu', username: 'demo_bao', genre: 'product' },
  { email: 'family@frameroom.test', name: 'Ha Do', username: 'demo_ha', genre: 'family' },
  { email: 'admin@frameroom.test', name: 'Demo Moderator', username: 'demo_admin' },
];
const images = [
  {
    genre: 'portrait',
    image: 'photo-1506794778202-cad84cf45f1d',
    caption: 'Natural-light portrait',
  },
  {
    genre: 'portrait',
    image: 'photo-1534528741775-53994a69daeb',
    caption: 'Soft outdoor portrait',
  },
  {
    genre: 'fashion',
    image: 'photo-1483985988355-763728e1935b',
    caption: 'Fashion and everyday style',
  },
  {
    genre: 'fashion',
    image: 'photo-1490481651871-ab68de25d43d',
    caption: 'Editorial fashion details',
  },
  {
    genre: 'food',
    image: 'photo-1546069901-ba9599a7e63c',
    caption: 'Fresh food and vibrant colors',
  },
  { genre: 'food', image: 'photo-1565299624946-b28f40a0ae38', caption: 'Warm food photography' },
  { genre: 'wedding', image: 'photo-1519741497674-611481863552', caption: 'A wedding celebration' },
  { genre: 'wedding', image: 'photo-1511285560929-80b456fea0bc', caption: 'Wedding-day moments' },
  {
    genre: 'product',
    image: 'photo-1523275335684-37898b6baf30',
    caption: 'Minimal product composition',
  },
  {
    genre: 'product',
    image: 'photo-1541643600914-78b084683601',
    caption: 'Product details and texture',
  },
  { genre: 'family', image: 'photo-1511895426328-dc8714191300', caption: 'Outdoor family moments' },
  { genre: 'family', image: 'photo-1511632765486-a01980e01a18', caption: 'A family together' },
];
try {
  const listed = await auth.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw listed.error;
  const accounts = new Map<string, string>();
  for (const person of people) {
    let id = listed.data.users.find((u) => u.email === person.email)?.id;
    if (!id) {
      const created = await auth.auth.admin.createUser({
        email: person.email,
        password,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      id = created.data.user.id;
    }
    accounts.set(person.email, id);
    await db.run(id, async (tx) => {
      await tx.execute(
        'insert into profiles(id,user_name,display_name) values($1,$2,$3) on conflict(id) do nothing',
        [id, person.username, person.name],
      );
      if ('genre' in person)
        await tx.execute(
          'insert into photographers(user_id,display_name,bio,city,district,genres,styles) values($1,$2,$3,$4,$5,$6,$7) on conflict(user_id) do nothing',
          [
            id,
            person.name,
            'Synthetic educational account. Portfolio photographs are licensed demo references, not work by this fictional provider.',
            'Ho Chi Minh City',
            'Thu Duc',
            [person.genre],
            ['natural', 'editorial'],
          ],
        );
    });
  }
  const managerId = accounts.get('manager@frameroom.test')!;
  const studio = await db.run(managerId, async (tx) => {
    let studio = await tx.optional<{ id: string }>(
      "select id from studios where created_by=$1 and name='Still Studio'",
      [managerId],
    );
    if (!studio) {
      studio = await tx.one<{ id: string }>(
        "insert into studios(name,description,city,district,address,genres,created_by) values('Still Studio','A fictional studio for the educational FrameRoom demo.','Ho Chi Minh City','District 3','Demo address',array['portrait','fashion']::genre[],$1) returning id",
        [managerId],
      );
      await tx.execute(
        "insert into studio_members(studio_id,user_id,role) values($1,$2,'manager')",
        [studio.id, managerId],
      );
    }
    await tx.execute(
      "insert into studio_members(studio_id,user_id,role) values($1,$2,'photographer') on conflict do nothing",
      [studio.id, accounts.get('photographer@frameroom.test')],
    );
    for (const name of ['Daylight room', 'Lighting kit'])
      await tx.execute(
        'insert into studio_resources(studio_id,name,type) select $1,$2,$3 where not exists(select 1 from studio_resources where studio_id=$1 and name=$2)',
        [studio.id, name, name === 'Daylight room' ? 'room' : 'equipment'],
      );
    await tx.execute(
      "insert into services(owner_type,studio_id,name,genre,duration_minutes,price,photo_count,retouched_count) select 'studio',$1,'Daylight studio session','portrait',120,2400000,30,8 where not exists(select 1 from services where studio_id=$1)",
      [studio.id],
    );
    return studio;
  });
  for (const person of people.filter((p) => 'genre' in p)) {
    const uid = accounts.get(person.email)!;
    const portfolio = await db.run(uid, async (tx) => {
      const photographer = await tx.one<{ id: string }>(
        'select id from photographers where user_id=$1',
        [uid],
      );
      await tx.execute(
        "insert into services(owner_type,photographer_id,name,genre,duration_minutes,price,photo_count,retouched_count) select 'photographer',$1,$2,$3,120,$4,20,5 where not exists(select 1 from services where photographer_id=$1)",
        [
          photographer.id,
          `${person.name} / ${person.genre}`,
          person.genre,
          person.genre === 'wedding' ? 5000000 : 1500000,
        ],
      );
      const existing = await tx.optional<{ id: string }>(
        'select id from portfolios where photographer_id=$1 limit 1',
        [photographer.id],
      );
      return (
        existing ??
        tx.one<{ id: string }>(
          "insert into portfolios(owner_type,photographer_id,title,description,genre,status,published_at) values('photographer',$1,$2,'Licensed educational reference images; this provider is fictional.',$3,'published',now()) returning id",
          [photographer.id, `${person.name} — Selected references`, person.genre],
        )
      );
    });
    for (const fixture of images.filter((i) => i.genre === person.genre)) {
      if (
        await db.run(uid, (tx) =>
          tx.optional('select id from portfolio_images where portfolio_id=$1 and source=$2', [
            portfolio.id,
            `https://images.unsplash.com/${fixture.image}`,
          ]),
        )
      )
        continue;
      const source = `https://images.unsplash.com/${fixture.image}`;
      const response = await fetch(`${source}?auto=format&fit=crop&w=1280&q=85`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Demo image download failed: ${fixture.image}`);
      const main = await sharp(Buffer.from(await response.arrayBuffer()))
        .rotate()
        .resize(1280, 1280, { fit: 'inside' })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      const thumb = await sharp(main.data)
        .resize(320, 320, { fit: 'inside' })
        .webp({ quality: 75 })
        .toBuffer();
      const path = `${uid}/${portfolio.id}/${uuidv7()}.webp`;
      await media.put('portfolio-images', path, main.data, 'image/webp');
      await media.put('portfolio-images', thumbnailPath(path), thumb, 'image/webp');
      await db.run(uid, (tx) =>
        tx.execute(
          'insert into portfolio_images(portfolio_id,storage_path,width,height,caption,source,collected_at,license_note) values($1,$2,$3,$4,$5,$6,now(),$7)',
          [
            portfolio.id,
            path,
            main.info.width,
            main.info.height,
            fixture.caption,
            source,
            'Unsplash License https://unsplash.com/license; local educational demo, fictional provider; no claim of authorship.',
          ],
        ),
      );
    }
  }
  await db.run(null, (tx) =>
    tx.execute(
      "insert into user_roles(user_id,role) values($1,'system_admin') on conflict do nothing",
      [accounts.get('admin@frameroom.test')],
    ),
  );
  const studioPortfolio = await db.run(managerId, async (tx) => {
    const existing = await tx.optional<{ id: string }>(
      'select id from portfolios where studio_id=$1 limit 1',
      [studio.id],
    );
    const p =
      existing ??
      (await tx.one<{ id: string }>(
        "insert into portfolios(owner_type,studio_id,title,description,genre,status,published_at) values('studio',$1,'Still Studio / Visual references','Licensed educational references, not work by this fictional studio.','portrait','published',now()) returning id",
        [studio.id],
      ));
    await tx.execute(
      "delete from portfolio_images where portfolio_id=$1 and storage_path like '%_thumb.webp'",
      [p.id],
    );
    return p;
  });
  const originals = await db.run(managerId, (tx) =>
    tx.rows<{ storagePath: string; caption: string; source: string; licenseNote: string }>(
      'select i.* from portfolio_images i join portfolios p on p.id=i.portfolio_id join photographers ph on ph.id=p.photographer_id where ph.user_id=$1',
      [accounts.get('photographer@frameroom.test')],
    ),
  );
  for (const source of originals) {
    const exists = await db.run(managerId, (tx) =>
      tx.optional('select id from portfolio_images where portfolio_id=$1 and source=$2', [
        studioPortfolio.id,
        source.source,
      ]),
    );
    if (exists) continue;
    const buffer = await media.download('portfolio-images', source.storagePath);
    await db.run(managerId, async (tx) => {
      const file = await media.upload(
        tx,
        managerId,
        'portfolio-images',
        studioPortfolio.id,
        buffer,
      );
      await tx.execute(
        'insert into portfolio_images(portfolio_id,storage_path,width,height,caption,source,collected_at,license_note) values($1,$2,$3,$4,$5,$6,now(),$7)',
        [
          studioPortfolio.id,
          file.storagePath,
          file.width,
          file.height,
          source.caption,
          source.source,
          source.licenseNote,
        ],
      );
    });
  }
  process.stdout.write(
    'Local demo accounts, studio, services, resources and licensed reference images seeded. No AI calls were made.\n',
  );
} finally {
  await db.close();
}
