import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { defineRoute, type ApiDependencies, type ApiModule } from '../plugins/route.js';
import {
  bookingInputSchema,
  bookingSchema,
  bookingWorkspaceSchema,
  briefContentSchema,
  briefVersionSchema,
  idSchema,
  scheduleBlockInputSchema,
  scheduleEntrySchema,
  scheduleInputSchema,
  scheduleQuerySchema,
  transitionInputSchema,
} from '../schemas/bookings.js';
import * as bookingService from '../services/bookings.js';

const bookingIdParamsSchema = z.object({ id: idSchema });
const briefParamsSchema = z.object({ id: idSchema, briefId: idSchema });

export const bookingModule: ApiModule = {
  name: 'bookings',
  register(app: FastifyInstance, deps: ApiDependencies) {
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/bookings',
      summary: 'List bookings accessible to the current user',
      access: 'verified',
      response: z.array(bookingSchema),
      handler: ({ transaction }) => transaction((tx) => bookingService.listBookings(tx)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/bookings',
      summary: 'Create a booking for an owned creative project',
      access: 'verified',
      status: 201,
      body: bookingInputSchema,
      response: bookingSchema,
      errors: [404, 409, 422],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => bookingService.createBooking(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/bookings/:id',
      summary: 'Get a booking accessible to the current user',
      access: 'verified',
      params: bookingIdParamsSchema,
      response: bookingSchema,
      handler: ({ params, transaction }) =>
        transaction((tx) => bookingService.getBooking(tx, params.id)),
    });
    // --- Slice 105b: Booking lifecycle transition and rescheduling routes ---
    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/bookings/:id/transitions',
      summary: 'Transition a booking through its lifecycle state machine',
      access: 'verified',
      status: 200,
      params: bookingIdParamsSchema,
      body: transitionInputSchema,
      response: bookingSchema,
      errors: [409, 422],
      handler: ({ params, body, transaction }) =>
        transaction((tx) => bookingService.transitionBooking(tx, params.id, body)),
    });

    defineRoute(app, deps, {
      method: 'PATCH',
      url: '/v1/bookings/:id/schedule',
      summary: 'Reschedule time slot, assigned photographer, or studio resources',
      access: 'verified',
      params: bookingIdParamsSchema,
      body: scheduleInputSchema,
      response: bookingSchema,
      errors: [409, 422],
      handler: ({ params, body, transaction }) =>
        transaction((tx) => bookingService.rescheduleBooking(tx, params.id, body)),
    });
    // --- Slice 105c: Brief version creation and approval routes ---
    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/bookings/:id/brief-versions',
      summary: 'Create a new brief version on an active booking',
      access: 'verified',
      status: 201,
      params: bookingIdParamsSchema,
      body: briefContentSchema,
      response: briefVersionSchema,
      errors: [422],
      handler: ({ actor, params, body, transaction }) =>
        transaction((tx) => bookingService.createBriefVersion(tx, params.id, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/bookings/:id/brief-versions/:briefId/approve',
      summary: 'Approve a brief version on behalf of client or provider',
      access: 'verified',
      status: 200,
      params: briefParamsSchema,
      response: briefVersionSchema,
      errors: [409, 422],
      handler: ({ actor, params, transaction }) =>
        transaction((tx) =>
          bookingService.approveBriefVersion(tx, params.id, params.briefId, actor.id),
        ),
    });

    // --- Slice 105d: Participant workspace projection route ---
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/bookings/:id/workspace',
      summary: 'Get the 13-part participant workspace for a booking',
      access: 'verified',
      status: 200,
      params: bookingIdParamsSchema,
      response: bookingWorkspaceSchema,
      handler: ({ actor, params, transaction }) =>
        transaction((tx) => bookingService.getBookingWorkspace(tx, params.id, actor.id)),
    });
    // --- Slice 105e: Personal and managed studio resource schedule routes ---
    defineRoute(app, deps, {
      method: 'GET',
      url: '/v1/me/schedule',
      summary: 'List schedule entries for owned photographers and managed studio resources',
      access: 'verified',
      status: 200,
      query: scheduleQuerySchema,
      response: z.array(scheduleEntrySchema),
      handler: ({ query, transaction }) =>
        transaction((tx) => bookingService.listMySchedule(tx, query)),
    });

    defineRoute(app, deps, {
      method: 'POST',
      url: '/v1/me/schedule/blocks',
      summary: 'Block time on an owned photographer or managed studio resource schedule',
      access: 'verified',
      status: 201,
      body: scheduleBlockInputSchema,
      response: scheduleEntrySchema,
      errors: [409, 422],
      handler: ({ actor, body, transaction }) =>
        transaction((tx) => bookingService.createScheduleBlock(tx, actor.id, body)),
    });

    defineRoute(app, deps, {
      method: 'DELETE',
      url: '/v1/me/schedule/blocks/:id',
      summary: 'Remove a manual schedule block (rejects booking-linked reservations)',
      access: 'verified',
      status: 204,
      params: bookingIdParamsSchema,
      response: z.void(),
      errors: [422],
      handler: ({ params, transaction }) =>
        transaction((tx) => bookingService.deleteScheduleBlock(tx, params.id)),
    });
  },
};
