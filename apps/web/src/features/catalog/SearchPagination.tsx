import { useEffect, useRef } from 'react';
import { Action } from '../../components/ui';
import { useStrings } from '../../lib/i18n';

type PageQuery = {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: (options?: { cancelRefetch: boolean }) => Promise<unknown>;
};

export function SearchPagination({ query, label }: { query: PageQuery; label?: string }) {
  const t = useStrings();
  const ref = useRef<HTMLDivElement>(null);
  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = query;
  const busy = useRef(isFetching);
  useEffect(() => {
    busy.current = isFetching;
  }, [isFetching]);
  useEffect(() => {
    if (
      !hasNextPage ||
      isFetching ||
      isFetchNextPageError ||
      !ref.current ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !busy.current) {
        void fetchNextPage({ cancelRefetch: false });
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching, isFetchNextPageError]);
  if (!hasNextPage) return null;
  return (
    <div className="load-more" ref={ref}>
      <Action
        secondary
        pending={isFetching}
        onClick={() => void fetchNextPage({ cancelRefetch: false })}
      >
        {isFetchNextPageError ? t.retry : (label ?? t.design.loadMore)}
      </Action>
    </div>
  );
}
