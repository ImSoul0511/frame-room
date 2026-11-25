import { useStrings } from '../../lib/i18n';
import { useApi } from '../../lib/hooks';
import type { Portfolio } from '../../lib/types';
import { genreImage, type Genre } from './genre-art';

export function GenreGlimpse({
  genre,
  onSelect,
  previous = false,
}: {
  genre: Genre;
  onSelect: () => void;
  previous?: boolean;
}) {
  const t = useStrings();
  const portfolios = useApi<Portfolio[]>(
    `/v1/portfolios?genre=${genre}&pageSize=2`,
    true,
    undefined,
    60_000,
  );
  const picture = portfolios.data?.find((portfolio) => portfolio.coverUrl);
  return (
    <button
      className={`genre-glimpse ${previous ? 'glimpse-before' : 'glimpse-after'}`}
      onClick={onSelect}
      aria-label={`${previous ? t.curation.previous : t.curation.next}: ${t.genreLabels[genre]}`}
    >
      <span className="glimpse-copy">
        <span>{t.genreLabels[genre]}</span>
        <strong>{t.curation.genreStories[genre].title}</strong>
      </span>
      <span className="glimpse-thumbnail" aria-hidden="true">
        <img src={picture?.coverUrl || genreImage(genre)} alt="" loading="lazy" decoding="async" />
      </span>
    </button>
  );
}
