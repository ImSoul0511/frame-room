import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { expect, it, vi } from 'vitest';
import { migrateMedia } from './migrate-media-webp.js';

it('keeps legacy keys, recovers a failed delivery metadata write, and skips converted bytes on retry', async () => {
  const path = 'booking/original.jpg';
  let mime = 'image/jpeg';
  let bytes = await sharp({
    create: { width: 1500, height: 800, channels: 3, background: 'green' },
  })
    .jpeg()
    .toBuffer();
  const delivery = { id: 'delivery', file_name: 'final.jpg', mime_type: mime };
  const store = {
    list: vi.fn(async (prefix: string) => ({
      data: prefix
        ? [{ id: 'file', name: 'original.jpg', metadata: { mimetype: mime, size: bytes.length } }]
        : [{ id: null, name: 'booking', metadata: null }],
    })),
    download: vi.fn(async () => ({ data: new Blob([Uint8Array.from(bytes)]) })),
    update: vi.fn(async (key: string, image: Buffer, options: { contentType: string }) => {
      expect(key).toBe(path);
      bytes = Buffer.from(image);
      mime = options.contentType;
      return { error: null };
    }),
  };
  let failRowWrite = true;
  const update = vi.fn((changes) => ({
    eq: () => ({
      eq: async () => {
        if (failRowWrite) return { error: new Error('interrupted') };
        Object.assign(delivery, changes);
        return { error: null };
      },
    }),
  }));
  const client = {
    storage: {
      listBuckets: async () => ({ data: [{ id: 'deliveries' }, { id: 'unrelated' }] }),
      from: () => store,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: delivery }) }) }),
      update,
    }),
  } as unknown as SupabaseClient;

  expect(await migrateMedia(client, false)).toMatchObject({
    checked: 1,
    conversions: 1,
    deliveryMetadata: 1,
  });
  expect(store.download).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    expect(await migrateMedia(client, true)).toMatchObject({ conversions: 1, failed: 1 });
  } finally {
    stderr.mockRestore();
  }
  expect(await sharp(bytes).metadata()).toMatchObject({ width: 1500, height: 800, format: 'webp' });
  failRowWrite = false;
  expect(await migrateMedia(client, true)).toMatchObject({
    conversions: 0,
    deliveryMetadata: 1,
    failed: 0,
  });
  expect(delivery).toMatchObject({ mime_type: 'image/webp', file_name: 'final.webp' });
  expect(await migrateMedia(client, true)).toMatchObject({ conversions: 0, deliveryMetadata: 0 });
  expect(store.update).toHaveBeenCalledTimes(1);
});
