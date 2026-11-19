import { z } from 'zod';
import { idSchema } from '@frameroom/shared';
import { authenticateVerified } from '../lib/auth.js';
import { ApiError, requireCondition } from '../lib/errors.js';
import type { ApiModule } from '../plugins/route.js';
import { MediaService, uploadBuckets, uploadInputLimit } from '../services/media.js';

const querySchema = z.object({ bucket: z.enum(uploadBuckets), scopeId: idSchema.optional() });
const outputSchema = z.object({
  storagePath: z.string(),
  mimeType: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export const uploadsModule: ApiModule = {
  name: 'uploads',
  register(app, deps) {
    const media = new MediaService(deps.env);
    deps.openApi.add({
      method: 'POST',
      url: '/v1/uploads',
      summary:
        'Upload one scoped image. Input limit: 50 MiB for portfolio, brief reference and room images, 20 MiB otherwise. Maximum 40 million pixels.',
      isPublic: false,
      status: 201,
      successStatuses: [],
      query: querySchema,
      body: z.object({ file: z.string().describe('Binary image file') }),
      requestContentType: 'multipart/form-data',
      response: outputSchema,
      envelope: true,
      errors: [400, 401, 403, 404, 413, 422, 503],
    });
    app.post('/v1/uploads', async (request, reply) => {
      const actor = await authenticateVerified(deps.authenticate, request.headers.authorization);
      const query = querySchema.parse(request.query);
      if (query.bucket === 'search-uploads')
        requireCondition(deps.env.AI_SEARCH_ENABLED, 503, 'ai_search_disabled');
      const prefix = await deps.db.run(actor.id, (tx) =>
        media.authorizeUpload(tx, actor.id, query.bucket, query.scopeId),
      );
      const inputLimit = uploadInputLimit(query.bucket);
      // Give the parser one byte of headroom so it can accept a file at the exact cap.
      const parts = request.parts({ limits: { fileSize: inputLimit + 1 } });
      let file: Buffer | undefined;
      let mime = '';
      try {
        for await (const part of parts) {
          requireCondition(part.type === 'file' && !file, 400, 'one_file_required');
          if (part.type === 'file') {
            file = await part.toBuffer();
            mime = part.mimetype;
          }
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if ((error as { statusCode?: number }).statusCode === 413)
          throw new ApiError(413, 'VALIDATION_ERROR', 'request_too_large');
        throw new ApiError(400, 'VALIDATION_ERROR', 'invalid_multipart');
      }
      requireCondition(file, 400, 'file_required');
      requireCondition(file.length <= inputLimit, 413, 'request_too_large');
      const result = await media.upload(query.bucket, prefix, file, mime);
      return reply.code(201).send({ data: outputSchema.parse(result) });
    });
  },
};
