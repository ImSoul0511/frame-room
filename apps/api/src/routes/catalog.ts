import { z } from 'zod';

import { defineRoute, type ApiModule } from '../plugins/route.js';
import {
  exploreProviderSchema,
  exploreQuerySchema,
  idParamsSchema,
  providerDetailSchema,
  providerSchema,
  tagSchema,
  myStudioSchema,
  studioInputSchema,
  studioSchema,
  studioTeamMemberSchema,
  ownedServiceSchema,
  serviceInputSchema,
  ownedPortfolioSchema,
  portfolioDetailSchema,
  portfolioImageInputSchema,
  portfolioImageSchema,
  portfolioImageTagsInputSchema,
  portfolioInputSchema,
  portfolioListQuerySchema,
  publicPortfolioSchema,
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
    // ---------- 102b: Studios & Team ----------
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/studios',
      summary: 'List studios where the caller is a member.',
      access: 'verified',
      response: z.array(myStudioSchema),
      handler: ({ actor, transaction }) => transaction((tx) => catalog.listMyStudios(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/studios',
      summary: 'Create a studio and add the caller as its initial manager.',
      access: 'verified',
      body: studioInputSchema,
      response: studioSchema,
      errors: [403],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => catalog.createStudio(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/studios/:id',
      summary: 'Update studio details (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      body: studioInputSchema,
      response: studioSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.updateStudio(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/studios/:id/team',
      summary: 'List members of a studio (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      response: z.array(studioTeamMemberSchema),
      errors: [403],
      handler: ({ actor, params, transaction }) =>
        transaction((tx) => catalog.getStudioTeam(tx, actor.id, params.id)),
    });
    // ---------- 102c: Services ----------
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/services',
      summary: 'List non-deleted services owned by the caller or their managed studios.',
      access: 'verified',
      response: z.array(ownedServiceSchema),
      handler: ({ actor, transaction }) =>
        transaction((tx) => catalog.listMyServices(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/services',
      summary: 'Create a personal photographer service.',
      access: 'verified',
      body: serviceInputSchema,
      response: ownedServiceSchema,
      errors: [403],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => catalog.createPersonalService(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/studios/:id/services',
      summary: 'Create a service owned by a studio (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      body: serviceInputSchema,
      response: ownedServiceSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.createStudioService(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/services/:id',
      summary: 'Update an owned photographer or studio service.',
      access: 'verified',
      params: idParamsSchema,
      body: serviceInputSchema,
      response: ownedServiceSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.updateService(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/services/:id',
      summary: 'Soft-delete an owned service and mark it inactive.',
      access: 'verified',
      params: idParamsSchema,
      status: 204,
      envelope: false,
      response: z.undefined(),
      errors: [403],
      handler: async ({ actor, params, transaction }) => {
        await transaction((tx) => catalog.deleteService(tx, actor.id, params.id));
        return undefined;
      },
    });
    // ---------- 102d: Portfolios & Images ----------
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/portfolios',
      summary: 'List non-deleted portfolios owned by the caller or their managed studios.',
      access: 'verified',
      response: z.array(ownedPortfolioSchema),
      handler: ({ actor, transaction }) =>
        transaction((tx) => catalog.listMyPortfolios(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/portfolios',
      summary: 'Browse published portfolios with optional genre and tag filters.',
      access: 'public',
      query: portfolioListQuerySchema,
      response: z.array(publicPortfolioSchema),
      handler: ({ query, transaction }) =>
        transaction((tx) => catalog.listPublicPortfolios(tx, query, deps.env.SUPABASE_URL)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/portfolios/:id',
      summary: 'Get portfolio detail with visible images and their tags.',
      access: 'public',
      params: idParamsSchema,
      response: portfolioDetailSchema,
      errors: [404],
      handler: ({ params, transaction }) =>
        transaction((tx) =>
          catalog.getPortfolioDetail(tx, params.id, undefined, deps.env.SUPABASE_URL),
        ),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/portfolios',
      summary: 'Create a personal photographer portfolio.',
      access: 'verified',
      body: portfolioInputSchema,
      response: ownedPortfolioSchema,
      errors: [403],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => catalog.createPersonalPortfolio(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/studios/:id/portfolios',
      summary: 'Create a portfolio owned by a studio (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      body: portfolioInputSchema,
      response: ownedPortfolioSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.createStudioPortfolio(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/portfolios/:id',
      summary: 'Update an owned photographer or studio portfolio.',
      access: 'verified',
      params: idParamsSchema,
      body: portfolioInputSchema,
      response: ownedPortfolioSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.updatePortfolio(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/portfolios/:id',
      summary: 'Soft-delete an owned portfolio.',
      access: 'verified',
      params: idParamsSchema,
      status: 204,
      envelope: false,
      response: z.undefined(),
      errors: [403],
      handler: async ({ actor, params, transaction }) => {
        await transaction((tx) => catalog.deletePortfolio(tx, actor.id, params.id));
        return undefined;
      },
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/portfolios/:id/images',
      summary: 'Attach an uploaded image to an owned portfolio with optional tags.',
      access: 'verified',
      params: idParamsSchema,
      body: portfolioImageInputSchema,
      response: portfolioImageSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) =>
          catalog.addPortfolioImage(tx, actor.id, params.id, body, deps.env.SUPABASE_URL),
        ),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/portfolio-images/:id/tags',
      summary: 'Replace tag assignments on a portfolio image.',
      access: 'verified',
      params: idParamsSchema,
      body: portfolioImageTagsInputSchema,
      response: z.array(tagSchema),
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.setPortfolioImageTags(tx, actor.id, params.id, body.tagIds)),
    });
  },
};
