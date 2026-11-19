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

// Empty strings from an unfilled .env.example line count as unset.
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

export const envSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: originSchema.default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AI_GATEWAY_API_KEY: optionalString,
  AI_TEXT_MODEL: z.string().min(1).default('google/gemini-3.8-flash'),
  AI_EMBEDDING_MODEL: z.string().min(1).default('google/gemini-embedding-2'),
  AI_IMAGE_MODEL: z.string().min(1).default('google/gemini-3.1-flash-image'),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().max(30).default(30),
});
export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv() {
  config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });
  const result = envSchema.safeParse({
    ...process.env,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  });
  if (!result.success) {
    throw new Error(
      `Invalid API configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return result.data;
}
