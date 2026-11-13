import type { FastifyInstance } from 'fastify';

import { ApiError, publicError } from '../lib/errors.js';

/** Sends every failure, including unknown routes, as the shared error envelope. */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const failure = publicError(error);
    if (failure.status >= 500) {
      // Log the code and reason always; the raw error only for unexpected failures.
      request.log.error(
        {
          code: failure.code,
          reason: failure.reason,
          ...(failure.status === 500 && { err: error }),
        },
        'Request failed',
      );
    }
    return reply.code(failure.status).send({
      error: { code: failure.code, message: failure.message, details: failure.details },
    });
  });
  app.setNotFoundHandler((_request, reply) => {
    const failure = new ApiError(404, 'NOT_FOUND', 'route_not_found', 'Route not found');
    return reply.code(failure.status).send({
      error: { code: failure.code, message: failure.message, details: failure.details },
    });
  });
}
