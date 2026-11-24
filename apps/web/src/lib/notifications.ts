import { useMutation, useQueryClient, type Query } from '@tanstack/react-query';
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
export type NoticePage = { items: Notice[]; hasMore: boolean };
type NoticeCache = Notice[] | NoticePage;

function mapNotices(data: NoticeCache | undefined, update: (notice: Notice) => Notice) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(update);
  return { ...data, items: data.items.map(update) };
}

export function useMarkNotificationRead() {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryFilter = {
    queryKey: ['api', session?.user.id ?? 'public'],
    predicate: (query: Query) => {
      const path = query.queryKey[2];
      return (
        typeof path === 'string' &&
        (path === '/v1/me/notifications' || path.startsWith('/v1/me/notifications/pages?'))
      );
    },
  };
  return useMutation({
    mutationKey: ['mark-notification-read', session?.user.id],
    mutationFn: (id: string) => patch<Notice>(`/v1/me/notifications/${id}`, {}),
    onMutate: async (id) => {
      await client.cancelQueries(queryFilter);
      const previous = client.getQueriesData<NoticeCache>(queryFilter).map(([key, data]) => ({
        key,
        notice: (Array.isArray(data) ? data : data?.items)?.find((item) => item.id === id),
      }));
      const optimisticTime = new Date().toISOString();
      client.setQueriesData<NoticeCache>(queryFilter, (data) =>
        mapNotices(data, (item) => (item.id === id ? { ...item, readAt: optimisticTime } : item)),
      );
      return { previous, optimisticTime };
    },
    onError: (_error, id, context) => {
      for (const entry of context?.previous ?? []) {
        if (!entry.notice) continue;
        const previousReadAt = entry.notice.readAt;
        client.setQueryData<NoticeCache>(entry.key, (data) =>
          mapNotices(data, (item) =>
            item.id === id && item.readAt === context?.optimisticTime
              ? { ...item, readAt: previousReadAt }
              : item,
          ),
        );
      }
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: ['mark-notification-read', session?.user.id] }) === 1)
        return client.invalidateQueries(queryFilter);
    },
  });
}
