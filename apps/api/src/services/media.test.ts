import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MediaService, requireStoragePath, thumbnailPath, webpFileName } from './media.js';
import { envSchema } from '../config/env.js';
import type { Transaction } from '../repositories/database.js';

const media = new MediaService(envSchema.parse({}));
beforeEach(() => {
  vi.spyOn(media, 'client').mockReturnValue({} as SupabaseClient);
});
afterEach(() => vi.restoreAllMocks());
describe('media boundary', () => {
  it.each([
    'https://example.com/image.webp',
    'user/../secret.webp',
    'user/a%2fb.webp',
    '/user/image.webp',
    'user\\image.webp',
  ])('rejects malformed storage path %s', (path) => {
    expect(() => requireStoragePath(path, 'user')).toThrow();
  });
  it('rejects foreign owner paths before reading Storage', async () => {
    const download = vi.spyOn(media, 'download');
    await expect(
      media.verify('brief-references', 'other/image.webp', 'user'),
    ).rejects.toMatchObject({ status: 403 });
    expect(download).not.toHaveBeenCalled();
  });
  it('normalizes a reference input over 20 MiB and produces a paired WebP thumbnail', async () => {
    const input = await sharp({
      create: { width: 4000, height: 2000, channels: 3, background: 'white' },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(input.length).toBeGreaterThan(20 * 1024 * 1024);
    const put = vi.spyOn(media, 'put').mockResolvedValue();
    const result = await media.upload('brief-references', 'user', input, 'image/png');
    expect(result.width).toBe(1280);
    expect(result.height).toBe(640);
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls.every((call) => call[2].length <= 2 * 1024 * 1024)).toBe(true);
    expect(put.mock.calls[1][1]).toBe(thumbnailPath(result.storagePath));
    const main = await sharp(put.mock.calls[0][2]).metadata();
    const thumb = await sharp(put.mock.calls[1][2]).metadata();
    expect(main.format).toBe('webp');
    expect(thumb.width).toBe(320);
    expect(thumb.height).toBe(160);
  });
  it('rejects MIME/bytes disagreement before upload', async () => {
    const input = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    const put = vi.spyOn(media, 'put');
    await expect(media.upload('avatars', 'user', input, 'image/jpeg')).rejects.toMatchObject({
      status: 400,
    });
    expect(put).not.toHaveBeenCalled();
  });
  it('stores final deliveries as a single full-resolution WebP with a matching download name', async () => {
    const input = await sharp({
      create: { width: 2400, height: 1500, channels: 3, background: 'white' },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const put = vi.spyOn(media, 'put').mockResolvedValue();
    const file = await media.upload('deliveries', 'booking', input, 'image/png');
    expect(file).toMatchObject({ mimeType: 'image/webp', width: 2400, height: 1500 });
    expect(file.storagePath).toMatch(/^booking\/.+\.webp$/);
    expect(put).toHaveBeenCalledTimes(1);
    const bytes = put.mock.calls[0][2];
    expect((await sharp(bytes).metadata()).format).toBe('webp');
    expect(bytes.length).toBeLessThan(input.length);
    expect(webpFileName('ceremony.edit.PNG')).toBe('ceremony.edit.webp');
  });
  it('removes the main object if its thumbnail upload fails', async () => {
    const input = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    const remove = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(media, 'client').mockReturnValue({
      storage: { from: () => ({ remove }) },
    } as unknown as SupabaseClient);
    vi.spyOn(media, 'put')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('failed thumbnail'));
    await expect(media.upload('avatars', 'user', input, 'image/png')).rejects.toThrow(
      'failed thumbnail',
    );
    expect(remove).toHaveBeenCalledOnce();
  });
  it('denies closed/foreign booking uploads before receiving bytes', async () => {
    const tx = { optional: vi.fn().mockResolvedValue(undefined) } as unknown as Transaction;
    await expect(media.authorizeUpload(tx, 'user', 'deliveries', 'booking')).rejects.toMatchObject({
      status: 404,
    });
  });
});
