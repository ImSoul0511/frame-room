import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
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
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['api'] }),
  });
}
