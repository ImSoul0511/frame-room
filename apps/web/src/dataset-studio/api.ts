import { z } from 'zod';
import type { Dataset } from './types';
import { s } from './strings';

const row = z.object({ id: z.string().uuid() }).passthrough();
const bootstrapSchema = z.object({
  token: z.string().min(20),
  data: z.object({
    photographers: z.array(row),
    portfolios: z.array(row),
    images: z.array(row.extend({ url: z.string().url() })),
    tags: z.array(row),
    assignments: z.array(
      z.object({ portfolio_image_id: z.string().uuid(), tag_id: z.string().uuid() }).passthrough(),
    ),
    ready: z.boolean(),
    delete_ready: z.boolean(),
    read_only: z.boolean(),
    migration: z.string(),
    delete_migration: z.string(),
    sets_ready: z.boolean().default(false),
    sets_migration: z
      .string()
      .default('supabase/migrations/202611180002_dataset_studio_photo_sets.sql'),
  }),
});
let token = '';
export async function fetchDataset(signal?: AbortSignal): Promise<Dataset> {
  const response = await fetch('/api/bootstrap?refresh=1', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(s.loadError);
  const parsed = bootstrapSchema.parse(await response.json());
  token = parsed.token;
  return parsed.data as unknown as Dataset;
}
export async function applyAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ id?: string }> {
  const response = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dataset-Token': token },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = z
      .object({
        error: z.object({
          code: z.string(),
          details: z.array(z.object({ reason: z.string().optional() })),
        }),
      })
      .safeParse(result);
    const code = error.success ? error.data.error.code : '';
    const setup =
      error.success &&
      error.data.error.details.some((detail) => detail.reason === 'migration_required');
    const deleteSetup =
      error.success &&
      error.data.error.details.some((detail) => detail.reason === 'delete_migration_required');
    const setsSetup =
      error.success &&
      error.data.error.details.some((detail) => detail.reason === 'sets_migration_required');
    throw new Error(
      setsSetup
        ? s.setsMigrationNeeded
        : deleteSetup
          ? s.deleteMigrationNeeded
          : setup
            ? s.migrationNeeded
            : code === 'CONFLICT'
              ? s.conflict
              : code === 'INVALID_INPUT'
                ? s.invalidInput
                : code === 'FORBIDDEN'
                  ? s.forbidden
                  : s.connectionLost,
    );
  }
  return z
    .object({ data: z.object({ id: z.string().uuid().nullable().optional() }).passthrough() })
    .parse(result).data as { id?: string };
}
