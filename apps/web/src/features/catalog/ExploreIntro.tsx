import { Link } from 'react-router-dom';
import type { Portfolio } from '../../lib/types';
import { useStrings } from '../../lib/i18n';
import { Botanical } from '../../components/Botanical';
import { Reveal } from '../../components/Reveal';
import { FittedImage } from '../../components/FittedImage';

export function ExploreIntro({
  portfolios,
  onGenre,
}: {
  portfolios: Portfolio[];
  onGenre: (genre: string) => void;
}) {
  const t = useStrings();
  const groups = [...new Set(portfolios.map((portfolio) => portfolio.genre))].slice(0, 3);
  return (
    <>
      <section className="genre-stories" aria-label={t.design.storiesTitle}>
        <Reveal>
          <div className="stories-heading">
            <p className="eyebrow">{t.design.storiesKicker}</p>
            <h2>
              <span className="section-highlight">{t.design.storiesTitle}</span>
            </h2>
            <p>{t.design.storiesDescription}</p>
          </div>
        </Reveal>
        {groups.map((genre, index) => {
          const works = portfolios
            .filter((portfolio) => portfolio.genre === genre && portfolio.coverUrl)
            .slice(0, 2);
          return works.length ? (
            <Reveal key={genre} className={`genre-story story-${index % 2}`}>
              <div className="story-copy">
                <p className="eyebrow">{t.design.selectedWorks}</p>
                <h3>
                  <span className="section-highlight">
                    {t.genreLabels[genre as keyof typeof t.genreLabels]}
                  </span>
                </h3>
                <p>{works[0].description || t.design.genreDescription}</p>
                <button className="text-button emphasis-link" onClick={() => onGenre(genre)}>
                  {t.design.exploreGenre}
                </button>
              </div>
              <div className="story-frames">
                {works.map((portfolio) => (
                  <Link
                    key={portfolio.id}
                    className="story-frame"
                    to={`/portfolios/${portfolio.id}`}
                  >
                    <FittedImage
                      src={portfolio.coverUrl!}
                      alt={portfolio.title}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="story-caption">{portfolio.title}</span>
                  </Link>
                ))}
              </div>
            </Reveal>
          ) : null;
        })}
      </section>
      <Reveal className="template-section">
        <section className="template-intro" aria-labelledby="template-title">
          <div className="template-preview" aria-hidden="true">
            <Botanical className="template-flower" />
            <div className="brief-paper">
              <span className="eyebrow">FrameRoom / Shoot Brief</span>
              <span className="brief-paper-title">{t.design.templatePreview}</span>
              <span className="brief-paper-line" />
              <span>{t.design.templateConcept}</span>
              <span className="brief-paper-line" />
              <span>{t.design.templateShotList}</span>
              <span className="brief-paper-line" />
              <span>{t.design.templateSchedule}</span>
            </div>
          </div>
          <div className="template-copy">
            <p className="eyebrow">{t.design.templateKicker}</p>
            <h2 id="template-title">
              <span className="section-highlight">{t.design.templateTitle}</span>
            </h2>
            <p>{t.design.templateDescription}</p>
            <Link className="button-link dark emphasis-link" to="/projects">
              {t.design.templateAction}
            </Link>
          </div>
        </section>
      </Reveal>
    </>
  );
}
