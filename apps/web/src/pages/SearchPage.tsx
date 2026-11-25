import { useVisible } from '../features/catalog/use-visible';
import { SearchPagination } from '../features/catalog/SearchPagination';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeading, QueryState } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';
import { RequestError, supabase } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { parsePeople } from '../lib/people';

const PAGE_SIZE = 20;

export function SearchPage() {
  const t = useStrings();
  const { ref: resultsStart, visible } = useVisible<HTMLDivElement>();
  const [params] = useSearchParams();
  const term = (params.get('q') ?? '').trim().slice(0, 60);
  const keyword = term.replace(/[%_\\]/g, '').trim();
  const results = useInfiniteQuery({
    queryKey: ['people-search', keyword],
    enabled: visible && Boolean(keyword),
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      if (!supabase) throw new RequestError(503, 'network_unavailable');
      const pattern = `%${keyword}%`;
      const rows = await Promise.all(
        ['display_name', 'user_name', 'photographers.display_name'].map((column) =>
          supabase!
            .from('profiles')
            .select(
              'id,display_name,user_name,avatar_path,photographers!inner(id,display_name,is_hidden)',
            )
            .eq('photographers.is_hidden', false)
            .ilike(column, pattern)
            .order('id')
            .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)
            .abortSignal(signal),
        ),
      );
      if (rows.some((result) => result.error)) throw new RequestError(503, 'network_unavailable');
      const people = parsePeople(rows.flatMap((result) => result.data ?? []));
      if (!people) throw new RequestError(502, 'invalid_response');
      return {
        people: people.filter((person) => person.photographerId),
        hasMore: rows.some((row) => (row.data?.length ?? 0) === PAGE_SIZE),
      };
    },
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  });
  const people = [
    ...new Map(
      results.data?.pages.flatMap((page) => page.people).map((person) => [person.id, person]) ?? [],
    ).values(),
  ];
  return (
    <section className="people-search-page">
      <PageHeading
        title={t.discovery.searchPhotographersTitle}
        subtitle={
          keyword
            ? `${t.discovery.searchPhotographersResults} “${term}”`
            : t.discovery.searchPhotographersPrompt
        }
      />
      <div className="search-start" ref={resultsStart} />
      {keyword ? <QueryState query={results} /> : null}
      {keyword && results.isSuccess && !people.length ? (
        <p className="empty-state">{t.discovery.searchPhotographersEmpty}</p>
      ) : null}
      <div className="people-search-grid">
        {people.map((person) => (
          <Link
            className="people-search-card"
            key={person.id}
            to={`/providers/photographer/${person.photographerId}`}
          >
            <UserAvatar
              name={person.displayName}
              avatarPath={person.avatarPath}
              className="people-search-avatar"
            />
            <span className="people-search-card-info">
              <strong>{person.displayName}</strong>
              <small>@{person.userName}</small>
            </span>
            <span className="people-search-card-link">
              {t.discovery.viewProfile} <span aria-hidden="true">↗</span>
            </span>
          </Link>
        ))}
      </div>
      <SearchPagination query={results} />
    </section>
  );
}
