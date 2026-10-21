import { healthResponseSchema } from '@frameroom/shared';

export async function fetchHealth(apiUrl: string, signal?: AbortSignal) {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
      : AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('API health request failed');
  return healthResponseSchema.parse(await response.json());
}
