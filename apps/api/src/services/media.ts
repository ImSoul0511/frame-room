import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp, { type Metadata, type OutputInfo } from 'sharp';
import { v7 as uuidv7 } from 'uuid';

import type { ApiEnv } from '../config/env.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import type { Transaction } from '../repositories/database.js';
import { requirePortfolioOwnership } from './catalog.js';

export const uploadBuckets = [
  'avatars',
  'profile-covers',
  'portfolio-images',
  'brief-references',
  'search-uploads',
  'gallery-previews',
  'room-files',
  'deliveries',
] as const;
export type UploadBucket = (typeof uploadBuckets)[number];
const publicBuckets = new Set(['avatars', 'profile-covers', 'portfolio-images']);
export const thumbnailPath = (path: string) => path.replace(/\.webp$/, '_thumb.webp');

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
  async url(bucket: string, path: string) {
    requireStoragePath(path);
    const storage = this.client().storage.from(bucket);
    if (publicBuckets.has(bucket)) return storage.getPublicUrl(path).data.publicUrl;
    const { data, error } = await storage.createSignedUrl(path, 300);
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
        bucket === 'deliveries'
          ? booking.status === 'proofing'
          : ['confirmed', 'in_progress'].includes(booking.status),
        422,
        'upload_locked',
      );
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
    requireCondition(input.length <= 20 * 1024 * 1024, 413, 'image_too_large');
    let metadata: Metadata;
    try {
      metadata = await sharp(input, { limitInputPixels: 40000000 }).metadata();
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_image');
    }
    const mime = metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format}`;
    requireCondition(
      ['image/jpeg', 'image/png', 'image/webp'].includes(mime) &&
        declaredMime === mime &&
        (metadata.pages ?? 1) === 1,
      400,
      'unsupported_image',
    );
    requireCondition(metadata.width && metadata.height, 400, 'invalid_image');
    if (bucket === 'deliveries') {
      try {
        await sharp(input, { limitInputPixels: 40000000 }).raw().toBuffer();
      } catch {
        throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_image');
      }
      const path = `${prefix}/${uuidv7()}.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`;
      await this.put(bucket, path, input, mime);
      return { storagePath: path, mimeType: mime, width: metadata.width, height: metadata.height };
    }
    let main: { data: Buffer; info: OutputInfo };
    try {
      main = await sharp(input, { limitInputPixels: 40000000 })
        .rotate()
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_image');
    }
    requireCondition(main.data.length <= 2097152, 400, 'image_too_large');
    const thumbnail = await sharp(main.data)
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    requireCondition(thumbnail.length <= 2097152, 400, 'image_too_large');
    const path = `${prefix}/${uuidv7()}.webp`;
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
  async verifyReference(
    userId: string,
    bucket: 'brief-references' | 'search-uploads',
    path: string,
  ) {
    await this.verify(bucket, path, userId);
    if (bucket === 'search-uploads') {
      const { data, error } = await this.client().storage.from(bucket).info(path);
      requireCondition(!error && data, 404, 'file_not_found');
      requireCondition(
        Number.isFinite(Date.parse(data.createdAt)) &&
          Date.parse(data.createdAt) > Date.now() - 86400000,
        410,
        'reference_expired',
      );
    }
  }
}
