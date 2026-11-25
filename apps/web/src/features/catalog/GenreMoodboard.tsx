import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import type { Image, Portfolio } from '../../lib/types';
import { genreImage, type Genre } from './genre-art';
import { BotanicalSpray } from '../../components/BotanicalSpray';

export function GenreMoodboard({ genre, destination }: { genre: Genre; destination: string }) {
  const t = useStrings();
  const portfolios = useApi<Portfolio[]>(
    `/v1/portfolios?genre=${genre}&pageSize=2`,
    true,
    undefined,
    60_000,
  );
  const covers = [
    ...new Map(
      (portfolios.data ?? [])
        .filter((portfolio) => portfolio.coverUrl)
        .map((portfolio) => [portfolio.coverUrl, portfolio]),
    ).values(),
  ];
  const first = portfolios.data?.[0];
  const gallery = useApi<{ images: Image[] }>(
    `/v1/portfolios/${first?.id ?? ''}`,
    Boolean(first) && covers.length < 2,
    undefined,
    60_000,
  );
  const pictures = [
    ...new Map([
      ...covers.map(
        (portfolio) =>
          [
            portfolio.coverUrl!,
            { url: portfolio.coverUrl!, destination: `/portfolios/${portfolio.id}` },
          ] as const,
      ),
      ...(gallery.data?.images ?? []).map(
        (image) =>
          [image.url, { url: image.url, destination: `/portfolios/${first!.id}` }] as const,
      ),
    ]).values(),
  ].slice(0, 2);
  const displayed = pictures.length
    ? pictures
    : portfolios.isPending
      ? []
      : [{ url: genreImage(genre), destination }];
  const loading =
    portfolios.isPending || (Boolean(first) && covers.length < 2 && gallery.isPending);
  return (
    <div
      className={`genre-moodboard${displayed.length === 1 && !loading ? ' is-single' : ''}`}
      data-count={loading ? 2 : displayed.length}
      aria-label={t.curation.inspirationPhotos}
    >
      <BotanicalSpray className="moodboard-sprig moodboard-sprig-back" />
      <div className="moodboard-frames">
        {displayed.map((picture) => (
          <Link key={picture.url} className="moodboard-photo" to={picture.destination}>
            <img
              src={picture.url}
              alt={`${t.genreLabels[genre]} · ${t.curation.illustration}`}
              loading="lazy"
              decoding="async"
            />
          </Link>
        ))}
        {loading
          ? Array.from({ length: 2 - displayed.length }, (_, index) => (
              <span
                key={index}
                className="moodboard-photo moodboard-placeholder"
                aria-hidden="true"
              />
            ))
          : null}
      </div>
      <BotanicalSpray className="moodboard-sprig moodboard-sprig-front" flowers={false} />
    </div>
  );
}
