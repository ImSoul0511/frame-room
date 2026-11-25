import { z } from 'zod';

import { createPortfolioUploadVerifier } from '../lib/portfolio-upload.js';
import { defineRoute, validateResponse, type ApiModule } from '../plugins/route.js';
import {
  exploreProviderSchema,
  directoryProviderSchema,
  exploreQuerySchema,
  idSchema,
  idParamsSchema,
  myInvitationSchema,
  myStudioSchema,
  ownedPortfolioSchema,
  ownedServiceSchema,
  photographerDisplayNameQuerySchema,
  photographerLookupParamsSchema,
  portfolioDetailSchema,
  portfolioImageInputSchema,
  portfolioImageSchema,
  portfolioImageTagsInputSchema,
  portfolioInputSchema,
  portfolioListQuerySchema,
  providerDetailSchema,
  providerListQuerySchema,
  publicPortfolioSchema,
  respondInvitationInputSchema,
  serviceAddOnInputSchema,
  serviceAddOnSchema,
  serviceInputSchema,
  studioInputSchema,
  studioInvitationInputSchema,
  studioInvitationSchema,
  studioMemberParamsSchema,
  studioResourceInputSchema,
  studioResourceSchema,
  studioSchema,
  studioTeamMemberSchema,
  tagSchema,
  updateStudioMemberRoleInputSchema,
  type ProviderLookup,
} from '../schemas/catalog.js';
import * as catalog from '../services/catalog.js';
import { createCloudCatalog } from '../services/cloud-catalog.js';
import { MediaService, requireStoragePath } from '../services/media.js';
import { requireCondition } from '../lib/errors.js';

/** 102: Provider discovery and catalog routes (/v1/*). */
export const catalogModule: ApiModule = {
  name: 'catalog',
  register(app, deps) {
    const cloud = deps.db.isConfigured ? null : createCloudCatalog(deps.env);
    const { API_PUBLIC_ORIGIN, SUPABASE_URL } = deps.env;
    const media = new MediaService(deps.env);
    const providerDetail = (type: 'photographer' | 'studio', lookup: ProviderLookup) =>
      cloud
        ? cloud.detail(type, lookup)
        : deps.db.run(null, (tx) =>
            catalog.getProviderDetail(tx, type, lookup, SUPABASE_URL, API_PUBLIC_ORIGIN),
          );
    app.get('/v1/portfolio-media', async (request, reply) => {
      const { path } = z.object({ path: z.string().max(500) }).parse(request.query);
      requireStoragePath(path);
      const visible = cloud
        ? await cloud.publicImageExists(path)
        : await deps.db.run(null, (tx) =>
            tx.optional(
              `select i.id from portfolio_images i join portfolios p on p.id=i.portfolio_id
           where i.storage_path=$1 and not i.is_hidden and p.status='published'
             and p.deleted_at is null and private.provider_visible(p.photographer_id,p.studio_id)
           limit 1`,
              [path],
            ),
          );
      requireCondition(visible, 404, 'file_not_found');
      const bytes = await media.download('portfolio-images', path);
      return reply
        .header('Cache-Control', 'private, max-age=60, must-revalidate')
        .header('X-Content-Type-Options', 'nosniff')
        .type(
          path.endsWith('.webp')
            ? 'image/webp'
            : path.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg',
        )
        .send(bytes);
    });
    const verifyPortfolioUpload = createPortfolioUploadVerifier(deps.env);
    // ---------- 102a: Public discovery ----------
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/explore',
      summary: 'Public provider discovery with genre, location, price and pagination filters.',
      access: 'public',
      query: exploreQuerySchema,
      response: z.array(exploreProviderSchema),
      handler: ({ query, transaction }) =>
        cloud
          ? cloud.list(query)
          : transaction((tx) =>
              catalog.exploreProviders(tx, query, SUPABASE_URL, API_PUBLIC_ORIGIN),
            ),
    });

    for (const [plural, type] of [
      ['photographers', 'photographer'],
      ['studios', 'studio'],
    ] as const) {
      defineRoute(app, deps, {
        method: 'GET',
        url: `/v1/${plural}`,
        summary: `List visible public ${plural} with pagination and filters.`,
        access: 'public',
        query: providerListQuerySchema,
        response: z.array(directoryProviderSchema),
        handler: ({ query, transaction }) =>
          cloud
            ? cloud.list(query, type)
            : transaction((tx) => catalog.listProviders(tx, type, query)),
      });

      defineRoute(app, deps, {
        method: 'GET',
        url: `/v1/${plural}/:id`,
        summary:
          type === 'photographer'
            ? 'Public photographer detail by exact display name or UUID.'
            : 'Public studio detail by UUID.',
        access: 'public',
        params: type === 'photographer' ? photographerLookupParamsSchema : idParamsSchema,
        response: providerDetailSchema,
        errors: type === 'photographer' ? [404, 409] : [404],
        handler: ({ params }) =>
          providerDetail(
            type,
            type === 'photographer' && !idSchema.safeParse(params.id).success
              ? { displayName: params.id }
              : { id: params.id },
          ),
      });
    }

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/photographers/by-name',
      summary:
        'Public photographer detail using an exact display name, including reserved path names.',
      access: 'public',
      query: photographerDisplayNameQuerySchema,
      response: providerDetailSchema,
      errors: [404, 409],
      handler: ({ query }) => providerDetail('photographer', { displayName: query.displayName }),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/tags',
      summary: 'List all taxonomy tags ordered by kind and name.',
      access: 'public',
      response: z.array(tagSchema),
      handler: ({ transaction }) =>
        cloud ? cloud.tags() : transaction((tx) => catalog.getAllTags(tx)),
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
      body: studioInputSchema.extend({
        city: z.string().trim().min(1).max(100),
        address: z.string().trim().min(1).max(200),
        contactEmail: z.string().trim().email().max(254),
      }),
      response: studioSchema,
      errors: [403],
      handler: ({ actor, body, transaction }) =>
        transaction(async (tx) =>
          validateResponse(studioSchema, await catalog.createStudio(tx, actor.id, body)),
        ),
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
        transaction(async (tx) =>
          validateResponse(studioSchema, await catalog.updateStudio(tx, actor.id, params.id, body)),
        ),
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
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/studios/:id/invitable-photographers',
      summary: 'Search active photographers eligible for a studio invitation.',
      access: 'verified',
      params: idParamsSchema,
      query: z.object({ term: z.string().trim().min(2).max(100) }),
      response: z.array(
        z.object({ id: z.string().uuid(), displayName: z.string(), userName: z.string() }),
      ),
      handler: ({ actor, params, query, transaction }) =>
        transaction(async (tx) => {
          await catalog.requireStudioManager(tx, params.id, actor.id);
          return tx.rows(
            `select p.id,p.display_name,pr.user_name from photographers p join profiles pr on pr.id=p.user_id
           where not p.is_hidden and (strpos(lower(p.display_name),lower($2))>0
             or strpos(lower(pr.user_name),lower($2))>0)
             and not exists (select 1 from studio_members m where m.studio_id=$1 and m.user_id=p.user_id)
             and not exists (select 1 from studio_invitations i where i.studio_id=$1 and i.photographer_id=p.id and i.status='pending')
           order by p.display_name,p.id limit 30`,
            [params.id, query.term],
          );
        }),
    });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/studios/:id/members/:userId/active-bookings',
      summary: 'List bookings currently assigned to this studio member.',
      access: 'verified',
      params: studioMemberParamsSchema,
      response: z.array(
        z.object({ id: z.string().uuid(), serviceName: z.string(), scheduledStart: z.string() }),
      ),
      handler: ({ actor, params, transaction }) =>
        transaction(async (tx) => {
          await catalog.requireStudioManager(tx, params.id, actor.id);
          return tx.rows(
            `select b.id,b.service_name,b.scheduled_start from bookings b
           join photographers p on p.id=b.assigned_photographer_id
           where b.studio_id=$1 and p.user_id=$2 and b.status not in ('rejected','cancelled','completed')
           order by b.scheduled_start,b.id`,
            [params.id, params.userId],
          );
        }),
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
      summary: 'Browse published portfolios with genre, tag, keyword and sort filters.',
      access: 'public',
      query: portfolioListQuerySchema,
      response: z.array(publicPortfolioSchema),
      handler: ({ query, transaction }) =>
        cloud
          ? cloud.portfolios(query)
          : transaction((tx) =>
              catalog.listPublicPortfolios(tx, query, SUPABASE_URL, API_PUBLIC_ORIGIN),
            ),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/portfolios/:id',
      summary: 'Get published portfolio detail with visible images and their tags.',
      access: 'public',
      params: idParamsSchema,
      response: portfolioDetailSchema,
      errors: [404],
      handler: ({ params, transaction }) =>
        cloud
          ? cloud.portfolio(params.id)
          : transaction((tx) =>
              catalog.getPortfolioDetail(tx, params.id, SUPABASE_URL, {
                apiOrigin: API_PUBLIC_ORIGIN,
              }),
            ),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/portfolios/:id',
      summary: 'Read a portfolio in the owner editor, including unpublished drafts.',
      access: 'verified',
      params: idParamsSchema,
      response: portfolioDetailSchema,
      errors: [403, 404],
      handler: ({ actor, params, transaction }) =>
        transaction((tx) =>
          catalog.getPortfolioDetail(tx, params.id, SUPABASE_URL, {
            ownerId: actor.id,
            ownerUrl: (path) => media.url('portfolio-images', path),
          }),
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
      summary: 'Attach an uploaded image to an owned portfolio with provenance and optional tags.',
      access: 'verified',
      params: idParamsSchema,
      body: portfolioImageInputSchema,
      response: portfolioImageSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) =>
          catalog.addPortfolioImage(
            tx,
            actor.id,
            params.id,
            body,
            verifyPortfolioUpload,
            deps.env.SUPABASE_URL,
          ),
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

    // ---------- 102e: Invitations, Members, Resources & Add-ons ----------
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/invitations',
      summary: 'List pending studio invitations for the caller.',
      access: 'verified',
      response: z.array(myInvitationSchema),
      handler: ({ actor, transaction }) =>
        transaction((tx) => catalog.listMyInvitations(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/studios/:id/invitations',
      summary: 'Invite a photographer to join a studio (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      body: studioInvitationInputSchema,
      response: studioInvitationSchema,
      errors: [403, 409],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.createStudioInvitation(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/invitations/:id',
      summary: 'Accept, decline, or revoke a pending studio invitation.',
      access: 'verified',
      params: idParamsSchema,
      body: respondInvitationInputSchema,
      response: studioInvitationSchema,
      errors: [403, 409],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.respondToInvitation(tx, actor.id, params.id, body.status)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/studios/:id/members/:userId',
      summary: 'Update a studio member role while protecting the last manager.',
      access: 'verified',
      params: studioMemberParamsSchema,
      body: updateStudioMemberRoleInputSchema,
      response: studioTeamMemberSchema,
      errors: [403, 409],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) =>
          catalog
            .updateStudioMemberRole(tx, actor.id, params.id, params.userId, body.role)
            .then((member) => validateResponse(studioTeamMemberSchema, member)),
        ),
    });

    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/studios/:id/members/:userId',
      summary:
        'Remove a studio member while protecting the last manager and active booking assignments.',
      access: 'verified',
      params: studioMemberParamsSchema,
      status: 204,
      envelope: false,
      response: z.undefined(),
      errors: [403, 409],
      handler: async ({ actor, params, transaction }) => {
        await transaction((tx) =>
          catalog.removeStudioMember(tx, actor.id, params.id, params.userId),
        );
        return undefined;
      },
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/studios/:id/resources',
      summary: 'List non-deleted resources of a studio (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      response: z.array(studioResourceSchema),
      errors: [403],
      handler: ({ actor, params, transaction }) =>
        transaction((tx) => catalog.listStudioResources(tx, actor.id, params.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/studios/:id/resources',
      summary: 'Create a studio resource (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      body: studioResourceInputSchema,
      response: studioResourceSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.createStudioResource(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/resources/:id',
      summary: 'Update a studio resource (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      body: studioResourceInputSchema,
      response: studioResourceSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.updateStudioResource(tx, actor.id, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/resources/:id',
      summary: 'Soft-delete a studio resource (current manager only).',
      access: 'verified',
      params: idParamsSchema,
      status: 204,
      envelope: false,
      response: z.undefined(),
      errors: [403],
      handler: async ({ actor, params, transaction }) => {
        await transaction((tx) => catalog.deleteStudioResource(tx, actor.id, params.id));
        return undefined;
      },
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/services/:id/add-ons',
      summary: 'List active add-ons for an active service of a visible provider.',
      access: 'public',
      params: idParamsSchema,
      response: z.array(serviceAddOnSchema),
      errors: [404],
      handler: ({ params, transaction }) =>
        transaction((tx) => catalog.listServiceAddOns(tx, params.id)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/services/:id/add-ons',
      summary: 'List active and inactive add-ons for an owned service.',
      access: 'verified',
      params: idParamsSchema,
      response: z.array(serviceAddOnSchema),
      errors: [403, 404],
      handler: ({ actor, params, transaction }) =>
        transaction((tx) => catalog.listOwnedAddOns(tx, actor.id, params.id)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/services/:id/add-ons/:addOnId',
      summary: 'Update an add-on for an owned service.',
      access: 'verified',
      params: z.object({ id: idSchema, addOnId: idSchema }),
      body: serviceAddOnInputSchema,
      response: serviceAddOnSchema,
      errors: [403, 404],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) =>
          catalog.updateServiceAddOn(tx, actor.id, params.id, params.addOnId, body),
        ),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/services/:id/add-ons',
      summary: 'Create an add-on for an owned service.',
      access: 'verified',
      params: idParamsSchema,
      body: serviceAddOnInputSchema,
      response: serviceAddOnSchema,
      errors: [403],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => catalog.createServiceAddOn(tx, actor.id, params.id, body)),
    });
  },
};
