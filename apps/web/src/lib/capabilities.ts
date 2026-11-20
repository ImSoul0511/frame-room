import { useQuery } from '@tanstack/react-query';
import { runtimeConfigSchema } from '@frameroom/shared';
import { api } from './api';
export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: async ({ signal }) => runtimeConfigSchema.parse(await api('/v1/config', { signal })),
    staleTime: 60000,
  });
}
