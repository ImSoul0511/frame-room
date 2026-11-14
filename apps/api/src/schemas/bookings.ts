import { z } from 'zod';

export const idSchema = z.string().uuid();

export const providerTypeSchema = z.enum(['photographer', 'studio']);

export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
  'in_progress',
  'proofing',
  'delivered',
  'completed',
]);

export const bookingInputSchema = z
  .object({
    serviceId: idSchema,
    projectId: idSchema,
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    addOnIds: z.array(idSchema).max(20).default([]),
    note: z.string().max(2000).default(''),
  })
  .refine(
    (v) => Date.parse(v.scheduledEnd) > Date.parse(v.scheduledStart),
    'End must follow start',
  );

export const bookingSchema = z.object({
  id: idSchema,
  clientId: idSchema,
  projectId: idSchema,
  serviceId: idSchema,
  ownerType: providerTypeSchema,
  photographerId: idSchema.nullable(),
  studioId: idSchema.nullable(),
  assignedPhotographerId: idSchema.nullable(),
  status: bookingStatusSchema,
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  totalPrice: z.number(),
  serviceName: z.string(),
  version: z.number().int(),
  agreedBriefVersion: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
export type Booking = z.infer<typeof bookingSchema>;
