import cors from '@fastify/cors';
import { healthResponseSchema } from '@frameroom/shared';
import Fastify from 'fastify';

import type { ApiEnv } from './config/env.js';

export function buildApp(env: ApiEnv) {
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
  app.get('/health', () => healthResponseSchema.parse({ ok: true, service: 'api' }));
  return app;
}
