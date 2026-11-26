import { useInfiniteQuery } from '@tanstack/react-query';
import { QueryState } from '../../components/ui';
import { api } from '../../lib/api';
import { useStrings } from '../../lib/i18n';
import { PhotoDiscoveryGrid, type DiscoveryPhoto } from '../catalog/PhotoDiscoveryGrid';
import { SearchPagination } from '../catalog/SearchPagination';

export function ProviderWorks({ type, id }: { type: 'photographer' | 'studio'; id: string }) {
  const t = useStrings();
  const query = useInfiniteQuery({
    queryKey: ['api', 'provider-photos', type, id],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        [type === 'photographer' ? 'photographerId' : 'studioId']: id,
        page: String(pageParam),
        pageSize: '12',
      });
      return api<DiscoveryPhoto[]>(`/v1/photos?${params}`, { signal });
    },
    getNextPageParam: (last, pages) => (last.length === 12 ? pages.length + 1 : undefined),
  });
  const photos = [
    ...new Map((query.data?.pages.flat() ?? []).map((photo) => [photo.id, photo])).values(),
  ];
  return (
    <>
      <h2>{t.provider.portfolios}</h2>
      <QueryState query={query} />
      {query.isSuccess && !photos.length && <p className="profile-empty">{t.profileUi.noWork}</p>}
      <PhotoDiscoveryGrid photos={photos} />
      <SearchPagination query={query} label={t.site.loadMorePhotos} />
    </>
  );
}
