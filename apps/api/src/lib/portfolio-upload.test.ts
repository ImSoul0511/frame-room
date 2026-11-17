import sharp from 'sharp';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { envSchema } from '../config/env.js';
import { createPortfolioUploadVerifier } from './portfolio-upload.js';

const storage = vi.hoisted(() => ({ download: vi.fn(), from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: storage.from } }),
}));

const env = envSchema.parse({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
});
const path = 'user/portfolio/image.webp';
const file = (buffer: Buffer) => ({ data: new Blob([new Uint8Array(buffer)]), error: null });
const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: 'white' } });

let main: Buffer;
let thumbnail: Buffer;
beforeAll(async () => {
  main = await image(640, 480).webp().toBuffer();
  thumbnail = await image(160, 120).webp().toBuffer();
});
beforeEach(() => {
  vi.resetAllMocks();
  storage.from.mockReturnValue({ download: storage.download });
  storage.download.mockImplementation(async (name: string) =>
    file(name.endsWith('_thumb.webp') ? thumbnail : main),
  );
});

describe('portfolio upload verification', () => {
  it('derives dimensions from decoded main bytes and verifies the thumbnail in the fixed bucket', async () => {
    await expect(createPortfolioUploadVerifier(env)(path)).resolves.toEqual({
      width: 640,
      height: 480,
    });
    expect(storage.from).toHaveBeenCalledWith('portfolio-images');
    expect(storage.download.mock.calls).toEqual([[path], ['user/portfolio/image_thumb.webp']]);
  });

  it('reports unavailable Storage without making a download request', async () => {
    await expect(createPortfolioUploadVerifier(envSchema.parse({}))(path)).rejects.toMatchObject({
      status: 503,
      reason: 'storage_not_configured',
    });
    expect(storage.download).not.toHaveBeenCalled();
  });

  it.each([1, 2])('rejects a missing main image or thumbnail (download %s)', async (missing) => {
    storage.download.mockResolvedValueOnce(missing === 1 ? { data: null, error: {} } : file(main));
    if (missing === 2) storage.download.mockResolvedValueOnce({ data: null, error: {} });
    await expect(createPortfolioUploadVerifier(env)(path)).rejects.toMatchObject({
      status: 404,
      reason: 'file_not_found',
    });
  });

  it('rejects corrupt bytes', async () => {
    storage.download.mockResolvedValueOnce(file(Buffer.from('not an image')));
    await expect(createPortfolioUploadVerifier(env)(path)).rejects.toMatchObject({
      status: 400,
      reason: 'invalid_image',
    });
  });

  it('rejects a PNG masquerading as normalized WebP', async () => {
    storage.download.mockResolvedValueOnce(file(await image(10, 10).png().toBuffer()));
    await expect(createPortfolioUploadVerifier(env)(path)).rejects.toMatchObject({
      status: 400,
      reason: 'invalid_image',
    });
  });

  it('rejects main images exceeding 1280 pixels', async () => {
    storage.download.mockResolvedValueOnce(file(await image(1281, 1).webp().toBuffer()));
    await expect(createPortfolioUploadVerifier(env)(path)).rejects.toMatchObject({
      status: 400,
      reason: 'invalid_image',
    });
  });

  it('rejects files exceeding the two MiB bucket cap', async () => {
    storage.download.mockResolvedValueOnce(file(Buffer.alloc(2 * 1024 * 1024 + 1)));
    await expect(createPortfolioUploadVerifier(env)(path)).rejects.toMatchObject({
      status: 400,
      reason: 'invalid_image',
    });
  });

  it('rejects thumbnails exceeding 320 pixels', async () => {
    storage.download.mockResolvedValueOnce(file(main));
    storage.download.mockResolvedValueOnce(file(await image(321, 1).webp().toBuffer()));
    await expect(createPortfolioUploadVerifier(env)(path)).rejects.toMatchObject({
      status: 400,
      reason: 'invalid_thumbnail',
    });
  });
});
