import { healthResponseSchema, runtimeConfigSchema } from '@frameroom/shared';
import { z } from 'zod';

import { defineRoute, type ApiModule } from '../plugins/route.js';

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
      response: runtimeConfigSchema,
      handler: async () => ({
        authConfigured: Boolean(deps.env.SUPABASE_URL && deps.env.SUPABASE_ANON_KEY),
        databaseConfigured: deps.db.isConfigured,
        aiConfigured: Boolean(deps.env.AI_GATEWAY_API_KEY),
        aiSearchEnabled: Boolean(deps.env.AI_SEARCH_ENABLED && deps.env.AI_GATEWAY_API_KEY),
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
