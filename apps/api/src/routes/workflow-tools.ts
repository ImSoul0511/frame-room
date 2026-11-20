import { z } from 'zod';
import rateLimit from '@fastify/rate-limit';
import {
  calendarRangeSchema,
  calendarSchema,
  changedCountSchema,
  idSchema,
  savedProviderInputSchema,
  savedProviderSchema,
  notificationSchema,
  notificationFilterSchema,
  notificationCountsSchema,
} from '@frameroom/shared';
import { defineRoute, type ApiModule } from '../plugins/route.js';
import { ApiError } from '../lib/errors.js';
import * as tools from '../services/workflow-tools.js';

export const workflowToolsModule: ApiModule = {
  name: 'workflow-tools',
  register(app, deps) {
    void app.register(async (scope) => {
      await scope.register(rateLimit, {
        max: 120,
        timeWindow: '1 minute',
        errorResponseBuilder: () => new ApiError(429, 'RATE_LIMITED', 'request_limit'),
      });
      defineRoute(scope, deps, {
        method: 'GET',
        url: '/v1/me/saved-providers',
        summary: 'List the caller’s saved visible providers.',
        access: 'verified',
        response: z.array(savedProviderSchema),
        handler: ({ actor, transaction }) =>
          transaction((tx) => tools.listSavedProviders(tx, actor.id)),
      });
      defineRoute(scope, deps, {
        method: 'POST',
        url: '/v1/me/saved-providers',
        summary: 'Save a visible provider idempotently.',
        access: 'verified',
        body: savedProviderInputSchema,
        response: savedProviderSchema,
        status: 200,
        errors: [404],
        handler: ({ actor, body, transaction }) =>
          transaction((tx) => tools.saveProvider(tx, actor.id, body)),
      });
      defineRoute(scope, deps, {
        method: 'DELETE',
        url: '/v1/me/saved-providers/:id',
        summary: 'Remove only the caller’s saved record.',
        access: 'verified',
        params: z.object({ id: idSchema }),
        response: z.undefined(),
        status: 204,
        handler: ({ actor, params, transaction }) =>
          transaction((tx) => tools.removeSavedProvider(tx, actor.id, params.id)),
      });
      defineRoute(scope, deps, {
        method: 'GET',
        url: '/v1/me/calendar',
        summary: 'Read authorized overlapping shoots and personal/resource blocks.',
        access: 'verified',
        query: calendarRangeSchema,
        response: calendarSchema,
        handler: ({ query, transaction }) => transaction((tx) => tools.readCalendar(tx, query)),
      });
      defineRoute(scope, deps, {
        method: 'GET',
        url: '/v1/me/notifications',
        summary: 'Read the most recent 100 notifications matching the caller’s filter.',
        access: 'verified',
        query: notificationFilterSchema,
        response: z.array(notificationSchema),
        handler: ({ actor, query, transaction }) =>
          transaction((tx) => tools.notificationInbox(tx, actor.id, query.state)),
      });
      defineRoute(scope, deps, {
        method: 'GET',
        url: '/v1/me/notifications/counts',
        summary: 'Count all of the caller’s unread notifications.',
        access: 'verified',
        response: notificationCountsSchema,
        handler: ({ actor, transaction }) =>
          transaction((tx) => tools.notificationCounts(tx, actor.id)),
      });
      defineRoute(scope, deps, {
        method: 'PATCH',
        url: '/v1/me/notifications/read-all',
        summary: 'Mark the caller’s unread notifications as read.',
        access: 'verified',
        body: z.object({}),
        response: changedCountSchema,
        handler: ({ actor, transaction }) =>
          transaction((tx) => tools.markAllNotificationsRead(tx, actor.id)),
      });
      defineRoute(scope, deps, {
        method: 'POST',
        url: '/v1/shoot-rooms/:id/checklist',
        summary: 'Import the agreed brief checklist once into open-room milestones.',
        access: 'verified',
        params: z.object({ id: idSchema }),
        body: z.object({}),
        response: changedCountSchema,
        status: 200,
        errors: [404, 422],
        handler: ({ actor, params, transaction }) =>
          transaction((tx) => tools.importBriefChecklist(tx, actor.id, params.id)),
      });
    });
  },
};
