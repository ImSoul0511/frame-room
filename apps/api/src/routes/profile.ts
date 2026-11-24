import { photographerInputSchema, profileInputSchema, profileSchema } from '@frameroom/shared';
import { z } from 'zod';

import { defineRoute, Respond, validateResponse, type ApiModule } from '../plugins/route.js';
import { ownPhotographerSchema } from '../schemas/own-photographer.js';
import * as profiles from '../services/profiles.js';
import { createCloudCatalog } from '../services/cloud-catalog.js';
import { MediaService } from '../services/media.js';

/** /v1/me and /v1/photographers/me. Routes stay thin; logic lives in services/profiles. */
export const profileModule: ApiModule = {
  name: 'profiles',
  register(app, deps) {
    const cloud = deps.db.isConfigured ? null : createCloudCatalog(deps.env);
    const media = new MediaService(deps.env);
    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/photographers/me/cover',
      summary: 'Set the caller’s photographer cover using an owned uploaded image.',
      access: 'verified',
      body: z.object({ coverPath: z.string().min(1).max(500) }),
      response: ownPhotographerSchema,
      errors: [400, 403, 404, 503],
      handler: async ({ actor, body, transaction }) => {
        await media.verify('profile-covers', body.coverPath, actor.id);
        return cloud
          ? cloud.updatePhotographerCover(actor.id, body.coverPath)
          : transaction((tx) => profiles.updatePhotographerCover(tx, actor.id, body.coverPath));
      },
    });
    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/me/avatar',
      summary: 'Set or clear the caller’s avatar using an owned uploaded image.',
      access: 'verified',
      body: z.object({ avatarPath: z.string().min(1).max(500).nullable() }),
      response: profileSchema,
      errors: [400, 403, 404, 503],
      handler: async ({ actor, body, transaction }) => {
        if (body.avatarPath) await media.verify('avatars', body.avatarPath, actor.id);
        return cloud
          ? cloud.updateAvatar(actor.id, body.avatarPath)
          : transaction((tx) => profiles.updateAvatar(tx, actor.id, body.avatarPath));
      },
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me',
      summary: 'Own profile with derived roles. Read-only; 404 profile_required if missing.',
      access: 'verified',
      response: profileSchema,
      errors: [404],
      handler: ({ actor, transaction }) =>
        cloud ? cloud.profile(actor.id) : transaction((tx) => profiles.getOwnProfile(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/me',
      summary: 'Create own profile. 201 on first create, 200 with the existing profile on retry.',
      access: 'verified',
      body: profileInputSchema,
      response: profileSchema,
      successStatuses: [200],
      errors: [409],
      handler: async ({ actor, body, transaction }) => {
        const { profile, created } = cloud
          ? await cloud.createProfile(actor.id, body)
          : await transaction((tx) => profiles.createOwnProfile(tx, actor.id, body));
        return created ? profile : new Respond(200, profile);
      },
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/me',
      summary: 'Update own user name and display name.',
      access: 'verified',
      body: profileInputSchema,
      response: profileSchema,
      errors: [404, 409],
      handler: ({ actor, body, transaction }) =>
        cloud
          ? cloud.updateProfile(actor.id, body)
          : transaction((tx) => profiles.updateOwnProfile(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/photographers/me',
      summary: 'Own photographer profile, or null when the caller has none.',
      access: 'verified',
      response: ownPhotographerSchema.nullable(),
      handler: ({ actor, transaction }) =>
        cloud
          ? cloud.photographer(actor.id)
          : transaction((tx) => profiles.getOwnPhotographer(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/photographers/me',
      summary: 'Create own photographer profile. Requires an existing profile.',
      access: 'verified',
      body: photographerInputSchema,
      response: ownPhotographerSchema,
      errors: [404, 409],
      handler: ({ actor, body, transaction }) =>
        cloud
          ? cloud.savePhotographer(actor.id, body)
          : transaction(async (tx) =>
              validateResponse(
                ownPhotographerSchema,
                await profiles.createOwnPhotographer(tx, actor.id, body),
              ),
            ),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/photographers/me',
      summary: 'Update own photographer profile.',
      access: 'verified',
      body: photographerInputSchema,
      response: ownPhotographerSchema,
      errors: [404],
      handler: ({ actor, body, transaction }) =>
        cloud
          ? cloud.savePhotographer(actor.id, body, true)
          : transaction(async (tx) =>
              validateResponse(
                ownPhotographerSchema,
                await profiles.updateOwnPhotographer(tx, actor.id, body),
              ),
            ),
    });
  },
};
