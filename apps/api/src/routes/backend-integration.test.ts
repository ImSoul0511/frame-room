import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { envSchema } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import type { Database, Transaction } from '../repositories/database.js';
import { MediaService } from '../services/media.js';
import * as projects from '../repositories/projects.js';

const actor = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const db: Database = {
  isConfigured: true,
  run: async (_id, fn) => fn({} as Transaction),
  close: async () => {},
};
const apps: ReturnType<typeof buildApp>[] = [];
function app() {
  const instance = buildApp(envSchema.parse({ LOG_LEVEL: 'silent' }), {
    db,
    authenticate: async (header) => {
      if (!header) throw new ApiError(401, 'UNAUTHORIZED', 'authentication_required');
      return { id: actor, isVerified: true };
    },
  });
  apps.push(instance);
  return instance;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  vi.restoreAllMocks();
});
const headers = { authorization: 'Bearer test' };
describe('media and project route integration', () => {
  it('publishes multipart upload and project operations', async () => {
    const document = (await app().inject({ url: '/v1/openapi.json' })).json();
    expect(
      document.paths['/v1/uploads'].post.requestBody.content['multipart/form-data'].schema
        .properties.file.format,
    ).toBe('binary');
    for (const method of ['get', 'post'])
      expect(document.paths['/v1/creative-projects'][method]).toBeDefined();
    for (const method of ['get', 'patch'])
      expect(document.paths['/v1/creative-projects/{id}'][method]).toBeDefined();
  });
  it('normalizes an authorized multipart upload through the media service', async () => {
    const authorize = vi.spyOn(MediaService.prototype, 'authorizeUpload').mockResolvedValue(actor);
    const upload = vi.spyOn(MediaService.prototype, 'upload').mockResolvedValue({
      storagePath: actor + '/image.webp',
      mimeType: 'image/webp',
      width: 100,
      height: 100,
    });
    const payload = Buffer.from(
      '--test\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\nexample-bytes\r\n--test--\r\n',
    );
    const response = await app().inject({
      method: 'POST',
      url: '/v1/uploads?bucket=avatars',
      headers: { ...headers, 'content-type': 'multipart/form-data; boundary=test' },
      payload,
    });
    expect(response.statusCode).toBe(201);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), actor, 'avatars', undefined);
    expect(upload).toHaveBeenCalledWith(
      'avatars',
      actor,
      Buffer.from('example-bytes'),
      'image/png',
    );
  });
  it('rejects an invalid upload bucket before receiving bytes', async () => {
    const authorize = vi.spyOn(MediaService.prototype, 'authorizeUpload');
    const response = await app().inject({
      method: 'POST',
      url: '/v1/uploads?bucket=other',
      headers,
    });
    expect(response.statusCode).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });
  it('authenticates before opening an upload transaction', async () => {
    const authorize = vi.spyOn(MediaService.prototype, 'authorizeUpload');
    const response = await app().inject({ method: 'POST', url: '/v1/uploads?bucket=avatars' });
    expect(response.statusCode).toBe(401);
    expect(authorize).not.toHaveBeenCalled();
  });
  it('returns the shared project response envelope', async () => {
    const project = {
      id: projectId,
      ownerId: actor,
      title: 'Project',
      idea: 'Portrait',
      bookingId: null,
      brief: null,
      referencePaths: [],
      selectedArtifactIds: [],
      version: 1,
      createdAt: '2026-11-18T00:00:00Z',
      updatedAt: '2026-11-18T00:00:00Z',
    };
    vi.spyOn(projects, 'findProject').mockResolvedValue(project);
    const response = await app().inject({ url: '/v1/creative-projects/' + projectId, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: project });
  });
  it('does not sign private reference URLs after project access is denied', async () => {
    vi.spyOn(projects, 'findProject').mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'project_not_found'),
    );
    const url = vi.spyOn(MediaService.prototype, 'url');
    const response = await app().inject({
      url: '/v1/creative-projects/' + projectId + '/references',
      headers,
    });
    expect(response.statusCode).toBe(404);
    expect(url).not.toHaveBeenCalled();
  });
});
