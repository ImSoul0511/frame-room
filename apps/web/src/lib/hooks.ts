import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, RequestError } from './api';
import { useAuth } from './auth';
import { useLocation } from 'react-router-dom';
import { invalidateResources, mutationResources } from './query-resources';
export function useApi<T>(path: string, enabled = true, poll?: number) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['api', session?.user.id ?? 'public', path],
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled,
    refetchInterval: poll,
    retry: false,
  });
}
export function useTask<TVariables = void, TData = unknown>(
  fn: (variables: TVariables) => Promise<TData>,
  resources?: readonly string[],
) {
  const client = useQueryClient();
  const { pathname } = useLocation();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateResources(client, resources ?? mutationResources(pathname)),
    onError: (error) => {
      if (error instanceof RequestError && error.status === 409)
        void invalidateResources(client, resources ?? mutationResources(pathname));
    },
  });
}
