import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const originSchema = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }, 'Use an HTTP(S) origin without a path or trailing slash');

export const envSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: originSchema.default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_TEXT_MODEL: z.string().default('google/gemini-3.8-flash'),
  AI_EMBEDDING_MODEL: z.string().default('google/gemini-embedding-2'),
  AI_IMAGE_MODEL: z.string().default('google/gemini-3.1-flash-image'),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().max(30).default(30),
});
export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv() {
  config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid API configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return result.data;
}
