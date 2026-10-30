import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { v7 as uuidv7 } from 'uuid';
import type { ApiEnv } from '../config/env.js';
import type { Transaction } from '../repositories/database.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import { booking, providerSide } from './access.js';
import { ownedRecord } from './catalog.js';
import { openRoom } from './collaboration.js';

export const uploadBuckets = [
  'portfolio-images',
  'brief-references',
  'search-uploads',
  'gallery-previews',
  'room-files',
  'deliveries',
  'avatars',
  'profile-covers',
] as const;
export type UploadBucket = (typeof uploadBuckets)[number];
export const thumbnailPath = (path: string) => path.replace(/\.webp$/, '_thumb.webp');
export class MediaService {
  readonly storage?: SupabaseClient;
  constructor(env: ApiEnv) {
    if (env.SUPABASE_SERVICE_ROLE_KEY)
      this.storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }
  client() {
    if (!this.storage) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'storage_not_configured');
    return this.storage;
  }
  async download(bucket: string, path: string) {
    requireCondition(
      /^[a-zA-Z0-9_/-]+\.(webp|jpg|jpeg|png)$/.test(path),
      400,
      'invalid_storage_path',
    );
    const { data, error } = await this.client().storage.from(bucket).download(path);
    if (error || !data) throw new ApiError(404, 'NOT_FOUND', 'file_not_found');
    return Buffer.from(await data.arrayBuffer());
  }
  async url(bucket: string, path: string, publicFile = false) {
    if (publicFile) return this.client().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.client().storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'signed_url_unavailable');
    return data.signedUrl;
  }
  async upload(
    tx: Transaction,
    userId: string,
    bucket: UploadBucket,
    scopeId: string | undefined,
    input: Buffer,
  ) {
    let prefix = userId;
    if (bucket === 'portfolio-images') {
      requireCondition(scopeId, 400, 'portfolio_required');
      await ownedRecord(tx, 'portfolios', scopeId);
      prefix = `${userId}/${scopeId}`;
    }
    if (bucket === 'gallery-previews' || bucket === 'deliveries') {
      requireCondition(scopeId, 400, 'booking_required');
      const b = await booking(tx, scopeId);
      await providerSide(tx, scopeId);
      prefix = scopeId;
      requireCondition(
        bucket === 'deliveries'
          ? b.status === 'proofing'
          : ['confirmed', 'in_progress'].includes(b.status),
        422,
        'upload_locked',
      );
    }
    if (bucket === 'room-files') {
      requireCondition(scopeId, 400, 'room_required');
      await openRoom(tx, scopeId);
      prefix = scopeId;
    }
    const metadata = await sharp(input, { limitInputPixels: 40000000 }).metadata();
    requireCondition(
      ['jpeg', 'png', 'webp'].includes(metadata.format ?? ''),
      400,
      'unsupported_image',
    );
    if (bucket === 'deliveries') {
      const ext = metadata.format === 'jpeg' ? 'jpg' : metadata.format!;
      const path = `${prefix}/${uuidv7()}.${ext}`;
      const mimeType = `image/${metadata.format}`;
      await this.put(bucket, path, input, mimeType);
      return { storagePath: path, mimeType, width: metadata.width, height: metadata.height };
    }
    const main = await sharp(input, { limitInputPixels: 40000000 })
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    requireCondition(main.data.length <= 2097152, 400, 'image_too_large');
    const path = `${prefix}/${uuidv7()}.webp`;
    const thumb = await sharp(main.data)
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await this.put(bucket, path, main.data, 'image/webp');
    try {
      await this.put(bucket, thumbnailPath(path), thumb, 'image/webp');
    } catch (error) {
      await this.client().storage.from(bucket).remove([path]);
      throw error;
    }
    return {
      storagePath: path,
      mimeType: 'image/webp',
      width: main.info.width,
      height: main.info.height,
    };
  }
  async put(bucket: string, path: string, input: Buffer | Uint8Array, mimeType: string) {
    const { error } = await this.client()
      .storage.from(bucket)
      .upload(path, input, { contentType: mimeType, upsert: false });
    if (error) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'upload_failed');
  }
  async verify(bucket: string, path: string, prefix: string, pair = true) {
    requireCondition(
      path.startsWith(`${prefix}/`) && !path.includes('..'),
      403,
      'invalid_storage_owner',
    );
    const buffer = await this.download(bucket, path);
    const metadata = await sharp(buffer, { limitInputPixels: 40000000 }).metadata();
    requireCondition(metadata.width && metadata.height, 400, 'invalid_image');
    if (pair) {
      requireCondition(
        metadata.format === 'webp' &&
          metadata.width <= 1280 &&
          metadata.height <= 1280 &&
          buffer.length <= 2097152,
        400,
        'invalid_image',
      );
      const thumb = await this.download(bucket, thumbnailPath(path));
      const m = await sharp(thumb).metadata();
      requireCondition(
        m.format === 'webp' && m.width && m.height && m.width <= 320 && m.height <= 320,
        400,
        'invalid_thumbnail',
      );
    }
    return {
      width: metadata.width,
      height: metadata.height,
      buffer,
      mimeType: `image/${metadata.format}`,
    };
  }
  async enforceReference(
    userId: string,
    bucket: 'brief-references' | 'search-uploads',
    path: string,
  ) {
    await this.verify(bucket, path, userId);
    if (bucket === 'search-uploads') {
      const { data, error } = await this.client().storage.from(bucket).info(path);
      requireCondition(!error && data, 404, 'file_not_found');
      requireCondition(
        Date.parse(data.createdAt) > Date.now() - 86400000,
        410,
        'reference_expired',
      );
    }
  }
}
