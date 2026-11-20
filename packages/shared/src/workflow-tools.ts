import { z } from 'zod';
import { bookingSchema, idSchema, providerTypeSchema } from './business.js';

export const savedProviderInputSchema = z.object({
  providerType: providerTypeSchema,
  providerId: idSchema,
});
export const savedProviderSchema = savedProviderInputSchema.extend({
  id: idSchema,
  createdAt: z.string(),
});
export type SavedProvider = z.infer<typeof savedProviderSchema>;
export const changedCountSchema = z.object({ count: z.number().int().nonnegative() });
export const notificationFilterSchema = z.object({
  state: z.enum(['all', 'unread', 'read']).default('all'),
});
export const notificationCountsSchema = z.object({
  unread: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export const calendarRangeSchema = z
  .object({ from: z.string().datetime(), to: z.string().datetime() })
  .refine(
    (range) =>
      Date.parse(range.to) > Date.parse(range.from) &&
      Date.parse(range.to) - Date.parse(range.from) <= 62 * 86400000,
    { message: 'Use a positive date range of at most 62 days', path: ['to'] },
  );
export const calendarBlockSchema = z.object({
  id: idSchema,
  label: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  resourceId: idSchema.nullable(),
});
export const calendarSchema = z.object({
  bookings: z.array(bookingSchema),
  blocks: z.array(calendarBlockSchema),
});
export type ShootCalendar = z.infer<typeof calendarSchema>;
