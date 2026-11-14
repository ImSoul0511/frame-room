import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { defineRoute, type ApiDependencies, type ApiModule } from '../plugins/route.js';
import { bookingInputSchema, bookingSchema, idSchema } from '../schemas/bookings.js';
import * as bookingService from '../services/bookings.js';

const bookingIdParamsSchema = z.object({ id: idSchema });

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
  },
};
