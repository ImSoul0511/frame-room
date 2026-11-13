import { z } from 'zod';

import { defineRoute, type ApiModule } from '../plugins/route.js';
import {
  exploreProviderSchema,
  exploreQuerySchema,
  idParamsSchema,
  providerDetailSchema,
  providerSchema,
  tagSchema,
} from '../schemas/catalog.js';
import * as catalog from '../services/catalog.js';

/** 102a: Public discovery routes (/v1/explore, /v1/photographers, /v1/studios, /v1/tags). */
export const catalogModule: ApiModule = {
  name: 'catalog',
  register(app, deps) {
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/explore',
      summary: 'Public provider discovery with genre, location, price and pagination filters.',
      access: 'public',
      query: exploreQuerySchema,
      response: z.array(exploreProviderSchema),
      handler: ({ query, transaction }) =>
        transaction((tx) => catalog.exploreProviders(tx, query, deps.env.SUPABASE_URL)),
    });

    for (const [plural, type] of [
      ['photographers', 'photographer'],
      ['studios', 'studio'],
    ] as const) {
      defineRoute(app, deps, {
        method: 'GET',
        url: `/v1/${plural}`,
        summary: `List visible public ${plural}.`,
        access: 'public',
        response: z.array(providerSchema),
        handler: ({ transaction }) => transaction((tx) => catalog.listProviders(tx, type)),
      });

      defineRoute(app, deps, {
        method: 'GET',
        url: `/v1/${plural}/:id`,
        summary: `Public ${type} detail with active services, published portfolios and visible reviews.`,
        access: 'public',
        params: idParamsSchema,
        response: providerDetailSchema,
        handler: ({ params, transaction }) =>
          transaction((tx) =>
            catalog.getProviderDetail(tx, type, params.id, deps.env.SUPABASE_URL),
          ),
      });
    }

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/tags',
      summary: 'List all taxonomy tags ordered by kind and name.',
      access: 'public',
      response: z.array(tagSchema),
      handler: ({ transaction }) => transaction((tx) => catalog.getAllTags(tx)),
    });
  },
};
