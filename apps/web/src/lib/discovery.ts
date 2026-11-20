import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { CardProvider } from '../features/catalog/ProviderCard';
export function useDiscovery() {
  return useQuery({
    queryKey: ['api', 'public', '/v1/explore'],
    queryFn: async ({ signal }) => {
      const cards: CardProvider[] = [];
      for (let page = 1; ; page++) {
        const batch = await api<CardProvider[]>(`/v1/explore?pageSize=50&page=${page}`, { signal });
        cards.push(...batch);
        if (batch.length < 50) return cards;
      }
    },
  });
}
