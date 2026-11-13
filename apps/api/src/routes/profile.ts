import { photographerInputSchema, profileInputSchema, profileSchema } from '@frameroom/shared';

import { defineRoute, Respond, type ApiModule } from '../plugins/route.js';
import { ownPhotographerSchema } from '../schemas/own-photographer.js';
import * as profiles from '../services/profiles.js';

/** /v1/me and /v1/photographers/me. Routes stay thin; logic lives in services/profiles. */
export const profileModule: ApiModule = {
  name: 'profiles',
  register(app, deps) {
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me',
      summary: 'Own profile with derived roles. Read-only; 404 profile_required if missing.',
      access: 'verified',
      response: profileSchema,
      envelope: false,
      handler: ({ actor, transaction }) =>
        transaction((tx) => profiles.getOwnProfile(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/me',
      summary: 'Create own profile. 201 on first create, 200 with the existing profile on retry.',
      access: 'verified',
      body: profileInputSchema,
      response: profileSchema,
      errors: [409],
      handler: async ({ actor, body, transaction }) => {
        const { profile, created } = await transaction((tx) =>
          profiles.createOwnProfile(tx, actor.id, body),
        );
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
      envelope: false,
      errors: [404, 409],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => profiles.updateOwnProfile(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/photographers/me',
      summary: 'Own photographer profile, or null when the caller has none.',
      access: 'verified',
      response: ownPhotographerSchema.nullable(),
      envelope: false,
      handler: ({ actor, transaction }) =>
        transaction((tx) => profiles.getOwnPhotographer(tx, actor.id)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/photographers/me',
      summary: 'Create own photographer profile. Requires an existing profile.',
      access: 'verified',
      body: photographerInputSchema,
      response: ownPhotographerSchema,
      envelope: false,
      errors: [404, 409],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => profiles.createOwnPhotographer(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/photographers/me',
      summary: 'Update own photographer profile.',
      access: 'verified',
      body: photographerInputSchema,
      response: ownPhotographerSchema,
      envelope: false,
      errors: [404],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => profiles.updateOwnPhotographer(tx, actor.id, body)),
    });
  },
};
