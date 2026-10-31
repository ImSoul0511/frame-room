import cors from '@fastify/cors';
import { healthResponseSchema } from '@frameroom/shared';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { Database } from './repositories/database.js';
import { createAuthenticator, type Authenticate } from './lib/auth.js';
import { publicError } from './lib/errors.js';
import { MediaService } from './services/media.js';
import { AiService } from './services/ai.js';
import { registerBusiness } from './routes/business.js';

import type { ApiEnv } from './config/env.js';

export function buildApp(
  env: ApiEnv,
  options: { db?: Database; authenticate?: Authenticate } = {},
) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'password',
          'token',
          'access_token',
          'refresh_token',
          'service_role',
        ],
        censor: '[REDACTED]',
      },
    },
  });
  void app.register(cors, {
    origin: (origin, callback) => callback(null, origin === env.WEB_ORIGIN),
  });
  void app.register(multipart, { limits: { fileSize: 20971520, files: 1, fields: 0 } });
  void app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        details: [{ reason: 'request_limit' }],
      },
    }),
  });
  const db = options.db ?? new Database(env.DATABASE_URL);
  const media = new MediaService(env);
  const ai = new AiService(env, db, media);
  app.setErrorHandler((error, request, reply) => {
    const failure = publicError(error);
    if (failure.status >= 500)
      request.log.error({ code: failure.code, reason: failure.reason }, 'Request failed');
    return reply.code(failure.status).send({
      error: {
        code: failure.code,
        message: failure.message,
        details: [{ reason: failure.reason }],
      },
    });
  });
  registerBusiness(app, {
    db,
    media,
    ai,
    env,
    authenticate: options.authenticate ?? createAuthenticator(env),
  });
  app.addHook('onClose', async () => {
    if (!options.db) await db.close();
  });
  app.get('/health', () => healthResponseSchema.parse({ ok: true, service: 'api' }));
  return app;
}
