import { v7 as uuidv7 } from 'uuid';
import { loadEnv } from './config/env.js';
import { Database } from './repositories/database.js';
import { enqueueIndex } from './services/ai-jobs.js';
const env = loadEnv();
if (!env.AI_GATEWAY_API_KEY)
  throw new Error('Set a budgeted AI_GATEWAY_API_KEY before indexing. No model calls were made.');
if (!env.DATABASE_URL || new URL(env.DATABASE_URL).hostname !== '127.0.0.1')
  throw new Error('This demo command is local-only.');
const db = new Database(env.DATABASE_URL);
try {
  const images = await db.run(null, (tx) =>
    tx.rows<{ id: string; userId: string }>(
      `select i.id,coalesce(ph.user_id,(select user_id from studio_members where studio_id=p.studio_id and role='manager' order by joined_at limit 1)) as user_id from portfolio_images i join portfolios p on p.id=i.portfolio_id left join photographers ph on ph.id=p.photographer_id where p.status='published' and p.deleted_at is null and not i.is_hidden and not exists(select 1 from image_embeddings e where e.image_id=i.id and e.model=$1) and not exists(select 1 from ai_jobs j where j.kind='index' and j.status in ('queued','running','uncertain') and j.input->>'imageId'=i.id::text) limit 200`,
      [env.AI_EMBEDDING_MODEL],
    ),
  );
  for (const image of images)
    await db.run(image.userId, (tx) => enqueueIndex(tx, image.userId, image.id, env, uuidv7()));
  process.stdout.write(
    `Queued ${images.length} permitted portfolio images. Start the worker to process them within the shared budget.\n`,
  );
} finally {
  await db.close();
}
