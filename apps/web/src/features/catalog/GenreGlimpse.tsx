import { useStrings } from '../../lib/i18n';
import { GenreSample } from './GenreSample';
import { genreImages, type Genre } from './genre-art';

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
        <GenreSample src={genreImages(genre)[0]!} alt="" />
      </span>
    </button>
  );
}
