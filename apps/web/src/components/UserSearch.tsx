import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStrings } from '../lib/i18n';

export function UserSearch() {
  const t = useStrings();
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState(() =>
    location.pathname === '/search' ? (new URLSearchParams(location.search).get('q') ?? '') : '',
  );
  return (
    <div className="user-search">
      <form
        role="search"
        aria-label={t.discovery.userSearch}
        onSubmit={(event) => {
          event.preventDefault();
          const query = draft.trim();
          if (query) navigate(`/search?${new URLSearchParams({ q: query })}`);
        }}
      >
        <label htmlFor="user-search" className="sr-only">
          {t.discovery.userSearch}
        </label>
        <input
          id="user-search"
          type="search"
          placeholder={t.discovery.searchPhotographersPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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
    </div>
  );
}
