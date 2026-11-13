import { genreSchema, idSchema, photographerInputSchema } from '@frameroom/shared';
import { z } from 'zod';

/**
 * Wire shape of the caller's own photographer row, kept identical to the MVP reference
 * (`select * from photographers`, camelCased). Shared has no response schema for it yet.
 * Move this to @frameroom/shared when Khoa agrees the export.
 */
export const ownPhotographerSchema = photographerInputSchema.extend({
  id: idSchema,
  userId: idSchema,
  genres: z.array(genreSchema),
  isHidden: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OwnPhotographer = z.output<typeof ownPhotographerSchema>;
