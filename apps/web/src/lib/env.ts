import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4000'),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
});
const configured = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || undefined,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || undefined,
});
// The local API binds IPv4 by default; localhost may resolve to ::1 in a browser.
const apiUrl = new URL(configured.VITE_API_URL);
if (import.meta.env.DEV && apiUrl.hostname === 'localhost') apiUrl.hostname = '127.0.0.1';
export const env = { ...configured, VITE_API_URL: apiUrl.href.replace(/\/$/, '') };
