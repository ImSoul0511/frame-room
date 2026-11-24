import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patch } from './api';
import { useAuth } from './auth';

export type Notice = {
  id: string;
  bookingId: string | null;
  studioId: string | null;
  event: string;
  createdAt: string;
  readAt: string | null;
};

export function useMarkNotificationRead() {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['api', session?.user.id ?? 'public', '/v1/me/notifications'];
  return useMutation({
    mutationKey: ['mark-notification-read', session?.user.id],
    mutationFn: (id: string) => patch<Notice>(`/v1/me/notifications/${id}`, {}),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Notice[]>(queryKey)?.find((item) => item.id === id);
      const optimisticTime = new Date().toISOString();
      client.setQueryData<Notice[]>(queryKey, (items) =>
        items?.map((item) => (item.id === id ? { ...item, readAt: optimisticTime } : item)),
      );
      return { previous, optimisticTime };
    },
    onError: (_error, id, context) => {
      client.setQueryData<Notice[]>(queryKey, (items) =>
        items?.map((item) =>
          item.id === id && item.readAt === context?.optimisticTime && context.previous
            ? context.previous
            : item,
        ),
      );
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: ['mark-notification-read', session?.user.id] }) === 1)
        return client.invalidateQueries({ queryKey });
    },
  });
}
