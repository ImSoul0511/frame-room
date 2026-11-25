import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp, { type OutputInfo } from 'sharp';
import { v7 as uuidv7 } from 'uuid';

import type { ApiEnv } from '../config/env.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import type { Transaction } from '../repositories/database.js';
import { requirePortfolioOwnership } from './catalog.js';
import { readConversation } from './conversations.js';
import { requireSubmittedSelection } from './collaboration.js';

export const uploadBuckets = [
  'avatars',
  'profile-covers',
  'portfolio-images',
  'brief-references',
  'gallery-previews',
  'room-files',
  'conversation-files',
  'deliveries',
] as const;
export type UploadBucket = (typeof uploadBuckets)[number];
export const defaultUploadInputLimit = 20 * 1024 * 1024;
const largeImageInputBuckets = new Set<UploadBucket>([
  'portfolio-images',
  'brief-references',
  'room-files',
  'conversation-files',
]);

export function uploadInputLimit(bucket: UploadBucket) {
  return largeImageInputBuckets.has(bucket) ? 50 * 1024 * 1024 : defaultUploadInputLimit;
}

const publicBuckets = new Set(['avatars', 'profile-covers']);
export const thumbnailPath = (path: string) => path.replace(/\.webp$/, '_thumb.webp');
export const webpFileName = (name: string) =>
  `${name.replace(/\.[^.]+$/, '').slice(0, 195) || 'photo'}.webp`;

export async function inspectImage(input: Buffer, declaredMime?: string) {
  const metadata = await sharp(input, { limitInputPixels: 40_000_000 })
    .metadata()
    .catch(() => {
      throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_image');
    });
  const mime = `image/${metadata.format}`;
  requireCondition(
    ['image/jpeg', 'image/png', 'image/webp'].includes(mime) &&
      (declaredMime === undefined || declaredMime === mime) &&
      (metadata.pages ?? 1) === 1,
    400,
    'unsupported_image',
  );
  requireCondition(metadata.width && metadata.height, 400, 'invalid_image');
  return metadata;
}

// Final photographs retain the delivered resolution up to the WebP format's dimension limit.
export async function encodeWebp(
  input: Buffer,
  maxSide: number,
  quality: number,
  byteLimit: number,
) {
  try {
    const image = sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true });
    for (let q = quality; q >= 45; q -= 10) {
      const result = await image.clone().webp({ quality: q }).toBuffer({ resolveWithObject: true });
      if (result.data.length <= byteLimit) return result;
    }
    throw new ApiError(400, 'VALIDATION_ERROR', 'image_too_large');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_image');
  }
}

export function requireStoragePath(path: string, prefix?: string) {
  requireCondition(
    /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(webp|jpg|jpeg|png)$/.test(path),
    400,
    'invalid_storage_path',
  );
  if (prefix) requireCondition(path.startsWith(`${prefix}/`), 403, 'invalid_storage_owner');
}

export class MediaService {
  readonly storage?: SupabaseClient;
  constructor(env: ApiEnv) {
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
      this.storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }
  client() {
    if (!this.storage) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'storage_not_configured');
    return this.storage;
  }
  async download(bucket: string, path: string) {
    requireStoragePath(path);
    const { data, error } = await this.client().storage.from(bucket).download(path);
    if (error || !data) throw new ApiError(404, 'NOT_FOUND', 'file_not_found');
    requireCondition(data.size <= 20 * 1024 * 1024, 400, 'image_too_large');
    return Buffer.from(await data.arrayBuffer());
  }
  async url(bucket: string, path: string, downloadName?: string) {
    requireStoragePath(path);
    const storage = this.client().storage.from(bucket);
    if (publicBuckets.has(bucket)) return storage.getPublicUrl(path).data.publicUrl;
    const { data, error } = await storage.createSignedUrl(path, 300, { download: downloadName });
    if (error || !data) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'signed_url_unavailable');
    return data.signedUrl;
  }
  async put(bucket: string, path: string, input: Buffer, mime: string) {
    const { error } = await this.client()
      .storage.from(bucket)
      .upload(path, input, { contentType: mime, upsert: false });
    if (error) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'upload_failed');
  }
  async authorizeUpload(tx: Transaction, userId: string, bucket: UploadBucket, scopeId?: string) {
    if (bucket === 'conversation-files') {
      requireCondition(scopeId, 400, 'invalid_input');
      await readConversation(tx, scopeId);
      return `${userId}/${scopeId}`;
    }
    if (bucket === 'portfolio-images') {
      requireCondition(scopeId, 400, 'portfolio_required');
      await requirePortfolioOwnership(tx, userId, scopeId);
      return `${userId}/${scopeId}`;
    }
    if (bucket === 'gallery-previews' || bucket === 'deliveries') {
      requireCondition(scopeId, 400, 'booking_required');
      const booking = await tx.optional<{ status: string }>(
        'select status from bookings where id=$1 and private.provider_side(id)',
        [scopeId],
      );
      requireCondition(booking, 404, 'booking_not_found');
      requireCondition(
        bucket === 'deliveries' ? booking.status === 'proofing' : booking.status === 'in_progress',
        422,
        'upload_locked',
      );
      if (bucket === 'deliveries') await requireSubmittedSelection(tx, scopeId);
      return scopeId;
    }
    if (bucket === 'room-files') {
      requireCondition(scopeId, 400, 'room_required');
      const room = await tx.optional(
        "select id from shoot_rooms where id=$1 and status='open' and private.can_read_room(id)",
        [scopeId],
      );
      requireCondition(room, 404, 'room_not_found');
      return scopeId;
    }
    return userId;
  }
  async upload(bucket: UploadBucket, prefix: string, input: Buffer, declaredMime: string) {
    this.client();
    requireCondition(input.length <= uploadInputLimit(bucket), 413, 'image_too_large');
    await inspectImage(input, declaredMime);
    const path = `${prefix}/${uuidv7()}.webp`;
    if (bucket === 'deliveries') {
      const { data, info } = await encodeWebp(input, 16383, 88, defaultUploadInputLimit);
      await this.put(bucket, path, data, 'image/webp');
      return { storagePath: path, mimeType: 'image/webp', width: info.width, height: info.height };
    }
    let main: { data: Buffer; info: OutputInfo } = await encodeWebp(input, 1280, 85, 2097152);
    if (bucket === 'gallery-previews') {
      const { width, height } = main.info;
      const marks = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            fill="white" stroke="#222" stroke-width="0.8" opacity="0.48"
            font-family="sans-serif" font-size="${Math.max(8, Math.round(width / 12))}">FrameRoom</text>
        </svg>`,
      );
      main = await sharp(main.data)
        .composite([{ input: marks }])
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    }
    requireCondition(main.data.length <= 2097152, 400, 'image_too_large');
    const thumbnail = await sharp(main.data)
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    requireCondition(thumbnail.length <= 2097152, 400, 'image_too_large');
    await this.put(bucket, path, main.data, 'image/webp');
    try {
      await this.put(bucket, thumbnailPath(path), thumbnail, 'image/webp');
    } catch (error) {
      const { error: cleanupError } = await this.client().storage.from(bucket).remove([path]);
      if (cleanupError) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'upload_cleanup_required');
      throw error;
    }
    return {
      storagePath: path,
      mimeType: 'image/webp',
      width: main.info.width,
      height: main.info.height,
    };
  }
  private async inspectUpload(bucket: string, path: string, maxSide?: number) {
    const bytes = await this.download(bucket, path);
    try {
      const image = sharp(bytes, { limitInputPixels: 40000000 });
      const { format, width, height, pages } = await image.metadata();
      requireCondition(
        format && ['jpeg', 'png', 'webp'].includes(format) && width && height && (pages ?? 1) === 1,
        400,
        'invalid_image',
      );
      if (maxSide !== undefined) {
        requireCondition(
          format === 'webp' && width <= maxSide && height <= maxSide && bytes.length <= 2097152,
          400,
          'invalid_image',
        );
      }
      await image.raw().toBuffer();
      return { width, height, mimeType: `image/${format}` };
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_image');
    }
  }
  async verify(bucket: string, path: string, prefix: string, pair = true) {
    requireStoragePath(path, prefix);
    if (!pair) return this.inspectUpload(bucket, path);
    requireCondition(
      path.endsWith('.webp') && !path.endsWith('_thumb.webp'),
      400,
      'invalid_storage_path',
    );
    const result = await this.inspectUpload(bucket, path, 1280);
    await this.inspectUpload(bucket, thumbnailPath(path), 320);
    return result;
  }
}
