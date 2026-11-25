import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from './config/env.js';
import {
  defaultUploadInputLimit,
  encodeWebp,
  inspectImage,
  MediaService,
  uploadBuckets,
  webpFileName,
} from './services/media.js';

type StoredObject = { path: string; mime?: string; size?: number; cacheControl?: string };

async function retryStorage<T>(action: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      const status = Number((error as { status?: number })?.status);
      if (attempt >= 2 || (status >= 400 && status < 500 && status !== 408 && status !== 429))
        throw error;
      await delay(500 * 2 ** attempt);
    }
  }
}

async function* listImages(
  client: SupabaseClient,
  bucket: string,
  prefix = '',
): AsyncGenerator<StoredObject> {
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const data = await retryStorage(async () => {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      return data;
    });
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        yield* listImages(client, bucket, path);
      } else {
        const mime = entry.metadata?.mimetype;
        if (
          ['image/jpeg', 'image/png', 'image/webp'].includes(mime ?? '') ||
          /\.(webp|jpe?g|png)$/i.test(path)
        ) {
          yield {
            path,
            mime,
            size: entry.metadata?.size,
            cacheControl: entry.metadata?.cacheControl?.match(/max-age=(\d+)/i)?.[1],
          };
        }
      }
    }
    if (data.length < pageSize) break;
  }
}

async function repairDelivery(client: SupabaseClient, path: string, apply: boolean) {
  const { data, error } = await client
    .from('deliveries')
    .select('id,file_name,mime_type')
    .eq('storage_path', path)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const fileName = webpFileName(data.file_name);
  if (data.mime_type === 'image/webp' && data.file_name === fileName) return false;
  if (apply) {
    const { error } = await client
      .from('deliveries')
      .update({ mime_type: 'image/webp', file_name: fileName })
      .eq('id', data.id)
      .eq('storage_path', path);
    if (error) throw error;
  }
  return true;
}

async function convertObject(client: SupabaseClient, bucket: string, file: StoredObject) {
  const store = client.storage.from(bucket);
  const maxInput = 50 * 1024 * 1024;
  if ((file.size ?? 0) > maxInput) throw new Error('Input exceeds the upload limit');
  const blob = await retryStorage(async () => {
    const { data, error } = await store.download(file.path);
    if (error) throw error;
    return data;
  });
  if (blob.size > maxInput) throw new Error('Input exceeds the upload limit');
  const input = Buffer.from(await blob.arrayBuffer());
  const meta = await inspectImage(input);
  const byteLimit =
    bucket === 'deliveries'
      ? defaultUploadInputLimit
      : (bucket === 'ai-artifacts' ? 5 : 2) * 1024 * 1024;
  const bytes =
    meta.format === 'webp' && input.length <= byteLimit
      ? input
      : (await encodeWebp(input, 16383, bucket === 'deliveries' ? 88 : 80, byteLimit)).data;
  // All database references, thumbnail paths, embedded brief versions and signed links
  // keep addressing the same key. Replace a whole object only after encoding succeeds.
  await retryStorage(async () => {
    const { error } = await store.update(file.path, bytes, {
      contentType: 'image/webp',
      cacheControl: file.cacheControl ?? '3600',
    });
    if (error) throw error;
  });
  return input.length - bytes.length;
}

export async function migrateMedia(client: SupabaseClient, apply: boolean) {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw error;
  const knownBuckets = new Set<string>([...uploadBuckets, 'ai-artifacts', 'search-uploads']);
  const totals = { checked: 0, conversions: 0, deliveryMetadata: 0, bytesSaved: 0, failed: 0 };
  for (const { id: bucket } of buckets) {
    if (!knownBuckets.has(bucket)) continue;
    for await (const file of listImages(client, bucket)) {
      totals.checked++;
      try {
        if (file.mime !== 'image/webp') {
          if (apply) totals.bytesSaved += await convertObject(client, bucket, file);
          totals.conversions++;
        }
        // Retry also repairs a crash after the object was replaced but before the row update.
        if (bucket === 'deliveries' && (await repairDelivery(client, file.path, apply)))
          totals.deliveryMetadata++;
      } catch (error) {
        totals.failed++;
        process.stderr.write(
          `${bucket}/${file.path}: ${error instanceof Error ? error.message : 'operation failed'}\n`,
        );
      }
      if (apply && totals.checked % 25 === 0)
        process.stdout.write(
          `Processed ${totals.checked} images; ${totals.conversions} converted; ${totals.failed} failed.\n`,
        );
    }
  }
  return totals;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply')) throw new Error('Usage: pnpm media:webp [--apply]');
  const apply = args.includes('--apply');
  const totals = await migrateMedia(new MediaService(loadEnv()).client(), apply);
  process.stdout.write(`${apply ? 'Applied' : 'Dry run'} ${JSON.stringify(totals)}\n`);
  if (totals.failed) process.exitCode = 1;
}
