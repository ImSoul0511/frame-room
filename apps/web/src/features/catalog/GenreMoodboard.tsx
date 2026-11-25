import { GenreSample } from './GenreSample';
import { Link } from 'react-router-dom';
import { useStrings } from '../../lib/i18n';
import { genreImages, type Genre } from './genre-art';
import { BotanicalSpray } from '../../components/BotanicalSpray';

export function GenreMoodboard({ genre, destination }: { genre: Genre; destination: string }) {
  const t = useStrings();
  const pictures = genreImages(genre);
  return (
    <div
      className="genre-moodboard"
      data-count={pictures.length}
      aria-label={t.curation.inspirationPhotos}
    >
      <BotanicalSpray className="moodboard-sprig moodboard-sprig-back" />
      <div className="moodboard-frames">
        {pictures.map((picture) => (
          <Link key={picture} className="moodboard-photo" to={destination}>
            <GenreSample
              src={picture}
              alt={`${t.genreLabels[genre]} · ${t.curation.illustration}`}
            />
          </Link>
        ))}
      </div>
      <BotanicalSpray className="moodboard-sprig moodboard-sprig-front" flowers={false} />
    </div>
  );
}
