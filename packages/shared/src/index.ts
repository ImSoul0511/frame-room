import { z } from 'zod';

export * from './business.js';
export * from './locale.js';
export * from './workspace.js';
export * from './workflow-tools.js';

export const roleSchema = z.enum(['client', 'photographer', 'studio_manager', 'system_admin']);
export type Role = z.infer<typeof roleSchema>;
export const registrationRoleSchema = z.enum(['client', 'photographer']);
export type RegistrationRole = z.infer<typeof registrationRoleSchema>;
export const healthResponseSchema = z.object({ ok: z.literal(true), service: z.string() });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const runtimeConfigSchema = z.object({
  authConfigured: z.boolean(),
  databaseConfigured: z.boolean(),
  storageConfigured: z.boolean(),
  aiConfigured: z.boolean(),
  aiSearchEnabled: z.boolean(),
});
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
