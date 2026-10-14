import { z } from 'zod';

export const roleSchema = z.enum(['user', 'photographer', 'studio_manager', 'system_admin']);
export type Role = z.infer<typeof roleSchema>;
export const healthResponseSchema = z.object({ ok: z.literal(true), service: z.string() });
export type HealthResponse = z.infer<typeof healthResponseSchema>;
