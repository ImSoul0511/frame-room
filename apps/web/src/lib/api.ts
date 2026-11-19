import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { errorSchema } from '@frameroom/shared';
import { env } from './env';
import { strings } from '../strings';
import { getLanguage } from './locale-store';
import { hotSingleton } from './hot-singleton';
export { currency, dateTime } from './format';

export const supabase = hotSingleton(import.meta.hot?.data, 'supabase-client', () =>
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null,
);
export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super();
  }
  get message() {
    return strings.errors[this.reason as keyof typeof strings.errors] ?? strings.errors.generic;
  }
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const headers = new Headers(options.headers);
  headers.set('accept-language', getLanguage());
  if (data.session) headers.set('authorization', `Bearer ${data.session.access_token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set('content-type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(120000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new RequestError(503, 'network_unavailable');
  }
  if (!response.ok) {
    const error = errorSchema.safeParse(await response.json().catch(() => null));
    throw new RequestError(
      response.status,
      error.success ? (error.data.error.details[0]?.reason ?? 'generic') : 'generic',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await request<unknown>(path, options);
  if (response === undefined) return undefined as T;
  const envelope = z
    .object({ data: z.unknown() })
    .refine((value) => 'data' in value)
    .safeParse(response);
  if (!envelope.success) throw new RequestError(502, 'invalid_response');
  return envelope.data.data as T;
}
export function post<T>(
  path: string,
  body: unknown = {},
  submissionId: string = crypto.randomUUID(),
) {
  return api<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'idempotency-key': submissionId },
  });
}
export function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function upload(file: File, bucket: string, scopeId?: string) {
  const largeImageBuckets = [
    'portfolio-images',
    'brief-references',
    'room-files',
    'conversation-files',
  ];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new RequestError(400, 'unsupported_image');
  if (file.size > (largeImageBuckets.includes(bucket) ? 50 : 20) * 1024 * 1024)
    throw new RequestError(413, 'file_too_large');
  const form = new FormData();
  form.append('file', file);
  return api<{ storagePath: string; mimeType: string }>(
    `/v1/uploads?${new URLSearchParams({ bucket, ...(scopeId ? { scopeId } : {}) })}`,
    { method: 'POST', body: form },
  );
}
