import { healthResponseSchema } from '@frameroom/shared';
import { z } from 'zod';

import { defineRoute, type ApiModule } from '../plugins/route.js';

const configSchema = z.object({
  authConfigured: z.boolean(),
  databaseConfigured: z.boolean(),
  storageConfigured: z.boolean(),
});

/** Health, public runtime configuration flags and the OpenAPI document. */
export const systemModule: ApiModule = {
  name: 'system',
  register(app, deps) {
    defineRoute(app, deps, {
      method: 'GET',
      url: '/health',
      summary: 'Liveness check. Does not touch the database.',
      access: 'public',
      envelope: false,
      response: healthResponseSchema,
      handler: async () => ({ ok: true as const, service: 'api' }),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/config',
      summary: 'Which backend integrations are configured. Booleans only, never values.',
      access: 'public',
      response: configSchema,
      handler: async () => ({
        authConfigured: Boolean(deps.env.SUPABASE_URL && deps.env.SUPABASE_ANON_KEY),
        databaseConfigured: deps.db.isConfigured,
        storageConfigured: Boolean(deps.env.SUPABASE_URL && deps.env.SUPABASE_SERVICE_ROLE_KEY),
      }),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/openapi.json',
      summary: 'OpenAPI document of the registered routes.',
      access: 'public',
      envelope: false,
      response: z.record(z.unknown()),
      handler: async () => deps.openApi.document(),
    });
  },
};
