import type { Database } from '../repositories/database.js';
import type { MediaService } from './media.js';

export async function expireSearchReferences(db: Database, media: MediaService) {
  const stale = await db.run(null, (tx) =>
    tx.rows<{ name: string }>(
      "select name from storage.objects where bucket_id='search-uploads' and created_at<now()-interval '24 hours' order by created_at limit 100",
    ),
  );
  if (!stale.length) return;
  const { error } = await media
    .client()
    .storage.from('search-uploads')
    .remove(stale.map((file) => file.name));
  if (error) throw new Error('Temporary reference cleanup failed');
}
