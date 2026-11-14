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

// --- Slice 105b: Reschedule and lifecycle transition payloads ---
export const scheduleInputSchema = z
  .object({
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    assignedPhotographerId: idSchema.optional(),
    resourceIds: z.array(idSchema).max(20).default([]),
    version: z.number().int().min(1),
  })
  .refine(
    (v) => Date.parse(v.scheduledEnd) > Date.parse(v.scheduledStart),
    'End must follow start',
  );

export const transitionInputSchema = z.object({
  to: bookingStatusSchema,
  version: z.number().int().min(1),
  reason: z.string().max(1000).default(''),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  assignedPhotographerId: idSchema.optional(),
  resourceIds: z.array(idSchema).max(20).default([]),
});

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export type TransitionInput = z.infer<typeof transitionInputSchema>;
