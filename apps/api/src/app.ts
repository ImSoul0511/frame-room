import cors from '@fastify/cors';
import Fastify from 'fastify';

import type { ApiEnv } from './config/env.js';
import { createAuthenticator, type Authenticate } from './lib/auth.js';
import { registerErrorHandling } from './plugins/error-handler.js';
import { OpenApiRegistry } from './plugins/openapi.js';
import type { ApiDependencies, ApiModule } from './plugins/route.js';
import { PgDatabase, type Database } from './repositories/database.js';
import { catalogModule } from './routes/catalog.js';
import { profileModule } from './routes/profile.js';
import { systemModule } from './routes/system.js';

export interface BuildAppOptions {
  /** Replace the Postgres adapter, mainly in tests. */
  db?: Database;
  /** Replace Supabase token verification, mainly in tests. */
  authenticate?: Authenticate;
  /** Extra modules registered after the built-in system and profile modules. */
  modules?: ApiModule[];
}

export function buildApp(env: ApiEnv, options: BuildAppOptions = {}) {
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
  registerErrorHandling(app);
  void app.register(cors, {
    origin: (origin, callback) => callback(null, origin === env.WEB_ORIGIN),
  });

  const db = options.db ?? new PgDatabase(env.DATABASE_URL);
  const dependencies: ApiDependencies = {
    env,
    db,
    authenticate: options.authenticate ?? createAuthenticator(env),
    openApi: new OpenApiRegistry(),
  };
  for (const module of [systemModule, profileModule, catalogModule, ...(options.modules ?? [])]) {
    module.register(app, dependencies);
  }
  // Only close a pool this function created.
  app.addHook('onClose', async () => {
    if (!options.db) await db.close();
  });
  return app;
}
