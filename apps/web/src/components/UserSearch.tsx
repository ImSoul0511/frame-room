import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase, RequestError } from '../lib/api';
import { useStrings } from '../lib/i18n';
import { parsePeople } from '../lib/people';

export function UserSearch() {
  const t = useStrings();
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const search = useQuery({
    queryKey: ['people-search', name],
    enabled: Boolean(name && open),
    queryFn: async ({ signal }) => {
      if (!supabase) throw new RequestError(503, 'network_unavailable');
      const pattern = `%${name.replace(/[%_\\]/g, '')}%`;
      const results = await Promise.all(
        ['display_name', 'user_name'].map((column) =>
          supabase!
            .from('profiles')
            .select('id,display_name,user_name,photographers(id,is_hidden)')
            .ilike(column, pattern)
            .limit(6)
            .abortSignal(signal),
        ),
      );
      if (results.some((result) => result.error))
        throw new RequestError(503, 'network_unavailable');
      const people = parsePeople(results.flatMap((result) => result.data ?? []));
      if (!people) throw new RequestError(502, 'invalid_response');
      return [...new Map(people.map((person) => [person.id, person])).values()].slice(0, 6);
    },
  });
  return (
    <div
      className="user-search"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <form
        role="search"
        aria-label={t.discovery.userSearch}
        onSubmit={(event) => {
          event.preventDefault();
          setName(draft.trim());
          setOpen(true);
        }}
      >
        <label htmlFor="user-search" className="sr-only">
          {t.discovery.userSearch}
        </label>
        <input
          id="user-search"
          type="search"
          placeholder={t.explore.search}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(false);
          }}
          maxLength={60}
        />
        <button type="submit" aria-label={t.discovery.userSearch} disabled={!draft.trim()}>
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
      </form>
      {open && name ? (
        <div className="user-search-results">
          <div className="row between">
            <strong>{t.discovery.people}</strong>
            <button className="text-button" onClick={() => setOpen(false)}>
              {t.close}
            </button>
          </div>
          <div role="status" aria-live="polite">
            {search.isPending ? (
              <p>{t.pending}</p>
            ) : search.error ? (
              <p>{search.error.message}</p>
            ) : !search.data?.length ? (
              <p>{t.discovery.noPeople}</p>
            ) : null}
          </div>
          {search.data?.map((person) => {
            const content = (
              <>
                <span className="person-initial">{person.displayName.slice(0, 1)}</span>
                <span>
                  <strong>{person.displayName}</strong>
                  <small>@{person.userName}</small>
                </span>
              </>
            );
            return person.photographerId ? (
              <Link
                key={person.id}
                className="person-result"
                to={`/providers/photographer/${person.photographerId}`}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            ) : (
              <div key={person.id} className="person-result">
                {content}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
