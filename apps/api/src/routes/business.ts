import rateLimit from '@fastify/rate-limit';
import { ApiError } from '../lib/errors.js';
import type { ApiModule } from '../plugins/route.js';
import { createBusinessContext } from './business/route.js';
import { registerStudio } from './business/studio.js';
import { registerBookings } from './business/bookings.js';
import { registerCollaboration } from './business/collaboration.js';
import { registerProofing } from './business/proofing.js';
import { registerModeration } from './business/moderation.js';
import { registerAi } from './business/ai.js';

export const businessModule: ApiModule = {
  name: 'business',
  register(app, deps) {
    void app.register(async (scope) => {
      await scope.register(rateLimit, {
        max: 120,
        timeWindow: '1 minute',
        errorResponseBuilder: () =>
          new ApiError(429, 'RATE_LIMITED', 'request_limit', 'Too many requests'),
      });
      const context = createBusinessContext(scope, deps);
      registerStudio(context);
      registerBookings(context);
      registerCollaboration(context);
      registerProofing(context);
      registerModeration(context);
      registerAi(context);
    });
  },
};
