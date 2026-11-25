import { genres, type OwnPhotographer } from '@frameroom/shared';
import { useStrings } from '../../lib/i18n';

export function GenreChoices({
  value,
  onChange,
}: {
  value: OwnPhotographer['genres'];
  onChange: (genres: OwnPhotographer['genres']) => void;
}) {
  const t = useStrings();
  return (
    <fieldset className="genre-choices">
      <legend>
        {t.portfolio.genre} <small>({value.length}/5)</small>
      </legend>
      <div>
        {genres.map((genre) => {
          const selected = value.includes(genre);
          return (
            <label key={genre}>
              <input
                type="checkbox"
                checked={selected}
                disabled={!selected && value.length >= 5}
                onChange={() =>
                  onChange(selected ? value.filter((item) => item !== genre) : [...value, genre])
                }
              />
              {t.genreLabels[genre]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
