import { z } from 'zod';
import { createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { v7 as uuidv7 } from 'uuid';
import * as schemas from '@frameroom/shared';
import { authenticateVerified } from '../../lib/auth.js';
import { ApiError, requireCondition } from '../../lib/errors.js';
import { requirePortfolioOwnership } from '../../services/catalog.js';
import { project } from '../../services/access.js';
import { enqueue, enqueueIndex } from '../../services/ai-jobs.js';
import { confirmAction } from '../../services/ai-actions.js';
import { search } from '../../services/search.js';
import { aiStreamError } from '../../services/ai-language.js';
import type { BusinessContext } from './route.js';
import { empty } from './route.js';

export function registerAi({ route, db, authenticate, env, ai, app }: BusinessContext) {
  if (env.AI_SEARCH_ENABLED) {
    route(
      'POST',
      '/v1/portfolio-images/:id/index',
      empty,
      async (c, tx) => {
        ai.ready();
        const image = await tx.one<{ portfolioId: string }>(
          'select portfolio_id from portfolio_images where id=$1',
          [c.params.id],
        );
        await requirePortfolioOwnership(tx, c.userId, image.portfolioId);
        return enqueueIndex(tx, c.userId, c.params.id, env, uuidv7());
      },
      { status: 202 },
    );
  }
  route('GET', '/v1/creative-projects/:id/messages', empty, async (c, tx) => {
    await project(tx, c.params.id);
    return tx.rows(
      'select id,role,content,created_at from ai_messages where project_id=$1 order by created_at,id',
      [c.params.id],
    );
  });
  route('GET', '/v1/creative-projects/:id/actions', empty, async (c, tx) => {
    await project(tx, c.params.id);
    return tx.rows(
      'select * from ai_actions where project_id=$1 and proposed_for=$2 order by created_at desc',
      [c.params.id, c.userId],
    );
  });
  route(
    'POST',
    '/v1/ai-actions/:id/confirm',
    empty,
    (c, tx) => confirmAction(tx, c.userId, c.params.id),
    { status: 200 },
  );
  route(
    'POST',
    '/v1/ai-actions/:id/reject',
    empty,
    async (c, tx) => {
      const a = await tx.one<{ projectId: string }>(
        'select project_id from ai_actions where id=$1 and proposed_for=$2',
        [c.params.id, c.userId],
      );
      await project(tx, a.projectId);
      return tx.one(
        "update ai_actions set status='rejected' where id=$1 and status='proposed' returning *",
        [c.params.id],
      );
    },
    { status: 200 },
  );
  route('GET', '/v1/creative-projects/:id/ai-jobs', empty, async (c, tx) => {
    await project(tx, c.params.id);
    return tx.rows(
      'select * from ai_jobs where project_id=$1 and user_id=$2 order by created_at desc limit 50',
      [c.params.id, c.userId],
    );
  });
  route(
    'POST',
    '/v1/creative-projects/:id/ai-jobs',
    schemas.jobInputSchema,
    async (c, tx, i) => {
      ai.ready();
      return enqueue(tx, c.userId, c.params.id, i, c.requestKey, c.language);
    },
    { status: 202 },
  );
  route('GET', '/v1/ai-jobs/:id', empty, async (c, tx) => {
    const j = await tx.one<{ projectId: string | null }>(
      'select * from ai_jobs where id=$1 and user_id=$2',
      [c.params.id, c.userId],
    );
    if (j.projectId) await project(tx, j.projectId);
    return j;
  });
  route('GET', '/v1/me/ai-usage', empty, (c, tx) =>
    tx.one(
      "select count(*)::int as requests,coalesce(sum(greatest(reserved_usd,coalesce(actual_usd,0))),0)::float as reserved_usd,coalesce(sum(image_count),0)::int as images from ai_usage where user_id=$1 and created_at>=date_trunc('month',now()) and status<>'released'",
      [c.userId],
    ),
  );
  if (env.AI_SEARCH_ENABLED) {
    app.post('/v1/search', async (request) => {
      const actor = await authenticateVerified(authenticate, request.headers.authorization);
      return search(
        db,
        ai,
        actor.id,
        schemas.searchInputSchema.parse(request.body),
        schemas.requestLanguage(request.headers['accept-language']),
      );
    });
  }
  app.post('/v1/creative-projects/:id/assistant', async (request) => {
    const actor = await authenticateVerified(authenticate, request.headers.authorization);
    const id = schemas.idSchema.parse((request.params as { id: string }).id);
    const input = schemas.assistantInputSchema.parse(request.body);
    const language = schemas.requestLanguage(request.headers['accept-language']);
    if (input.mode === 'brief') return { data: await ai.plan(actor.id, id, input.text, language) };
    if (input.mode === 'action')
      return { data: await ai.proposeAction(actor.id, id, input.text, language) };
    throw new ApiError(400, 'VALIDATION_ERROR', 'use_streaming_chat');
  });
  app.post('/v1/creative-projects/:id/chat', async (request, reply) => {
    const actor = await authenticateVerified(authenticate, request.headers.authorization);
    const id = schemas.idSchema.parse((request.params as { id: string }).id);
    const body = z
      .object({
        messages: z
          .array(
            z.object({
              role: z.string(),
              parts: z.array(z.object({ type: z.string(), text: z.string().optional() })),
            }),
          )
          .max(100),
      })
      .parse(request.body);
    const last = body.messages.at(-1);
    requireCondition(last?.role === 'user', 400, 'user_message_required');
    const text = z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .parse(
        last.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
          .join('\n'),
      );
    const language = schemas.requestLanguage(request.headers['accept-language']);
    const stream = await ai.chat(actor.id, id, text, language);
    return reply.send(
      createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: stream.stream,
          sendReasoning: false,
          onError: () => aiStreamError(language),
        }),
      }),
    );
  });
}
