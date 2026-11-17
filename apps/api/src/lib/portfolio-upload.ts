import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import type { ApiEnv } from '../config/env.js';
import { ApiError } from './errors.js';

export type VerifyPortfolioUpload = (path: string) => Promise<{ width: number; height: number }>;

/** Verifies stored bytes and their paired thumbnail; request metadata is never authoritative. */
export function createPortfolioUploadVerifier(env: ApiEnv): VerifyPortfolioUpload {
  const storage =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        }).storage.from('portfolio-images')
      : undefined;

  async function inspect(path: string, maxSide: number, reason: string) {
    if (!storage) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'storage_not_configured');
    const { data, error } = await storage.download(path);
    if (error || !data) throw new ApiError(404, 'NOT_FOUND', 'file_not_found');
    if (data.size > 2 * 1024 * 1024) throw new ApiError(400, 'VALIDATION_ERROR', reason);
    try {
      const image = sharp(Buffer.from(await data.arrayBuffer()), { limitInputPixels: 40000000 });
      const metadata = await image.metadata();
      if (
        metadata.format !== 'webp' ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > maxSide ||
        metadata.height > maxSide ||
        (metadata.pages ?? 1) > 1
      ) {
        throw new Error('Invalid normalized image');
      }
      // Decode pixels as well as headers so truncated/corrupt files cannot be registered.
      await image.raw().toBuffer();
      return { width: metadata.width, height: metadata.height };
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', reason);
    }
  }

  return async (path) => {
    const dimensions = await inspect(path, 1280, 'invalid_image');
    await inspect(path.replace(/\.webp$/, '_thumb.webp'), 320, 'invalid_thumbnail');
    return dimensions;
  };
}
