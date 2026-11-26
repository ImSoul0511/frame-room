import { genres } from '@frameroom/shared';
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
        {genres.map((option) => (
          <span className="glimpse-caption" key={option} aria-hidden={option !== genre}>
            <span>{t.genreLabels[option]}</span>
            <strong>{t.curation.genreStories[option].title}</strong>
          </span>
        ))}
      </span>
      <span className="glimpse-thumbnail" aria-hidden="true">
        <GenreSample key={genre} src={genreImages(genre)[0]!} alt="" />
      </span>
    </button>
  );
}
