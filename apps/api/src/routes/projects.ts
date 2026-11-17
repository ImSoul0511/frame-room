import {
  artifactSchema,
  idSchema,
  projectInputSchema,
  projectPatchSchema,
  projectSchema,
} from '@frameroom/shared';
import { z } from 'zod';
import { defineRoute, type ApiModule } from '../plugins/route.js';
import { MediaService } from '../services/media.js';
import * as repo from '../repositories/projects.js';
import { patchProject } from '../services/projects.js';

export const projectsModule: ApiModule = {
  name: 'projects',
  register(app, deps) {
    const media = new MediaService(deps.env);
    const params = z.object({ id: idSchema });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/creative-projects',
      summary: 'List accessible creative projects.',
      access: 'verified',
      response: z.array(projectSchema),
      handler: ({ transaction }) => transaction(repo.listProjects),
    });
    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/creative-projects',
      summary: 'Create an owned creative project.',
      access: 'verified',
      body: projectInputSchema,
      response: projectSchema,
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => repo.insertProject(tx, actor.id, body.title, body.idea)),
    });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/creative-projects/:id',
      summary: 'Read an accessible creative project.',
      access: 'verified',
      params,
      response: projectSchema,
      handler: ({ params, transaction }) => transaction((tx) => repo.findProject(tx, params.id)),
    });
    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/creative-projects/:id',
      summary: 'Update an owned open project and increment its version.',
      access: 'verified',
      params,
      body: projectPatchSchema,
      response: projectSchema,
      errors: [409, 422],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => patchProject(tx, actor.id, params.id, body, media)),
    });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/creative-projects/:id/references',
      summary: 'Issue five-minute URLs for accessible project references.',
      access: 'verified',
      params,
      response: z.array(z.object({ storagePath: z.string(), url: z.string() })),
      handler: ({ params, transaction }) =>
        transaction(async (tx) => {
          const project = await repo.findProject(tx, params.id);
          return Promise.all(
            project.referencePaths.map(async (path) => ({
              storagePath: path,
              url: await media.url('brief-references', path),
            })),
          );
        }),
    });
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/creative-projects/:id/artifacts',
      summary: 'List accessible project artifacts with five-minute URLs.',
      access: 'verified',
      params,
      response: z.array(artifactSchema),
      handler: ({ params, transaction }) =>
        transaction(async (tx) => {
          await repo.findProject(tx, params.id);
          const rows = await tx.rows<z.input<typeof artifactSchema>>(
            'select * from ai_artifacts where project_id=$1 order by created_at desc,id',
            [params.id],
          );
          return Promise.all(
            rows.map(async (row) => ({
              ...row,
              url: await media.url('ai-artifacts', row.storagePath),
            })),
          );
        }),
    });
  },
};
