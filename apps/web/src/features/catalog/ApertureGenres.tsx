import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { genres } from '@frameroom/shared';
import { useStrings } from '../../lib/i18n';
import { ApertureRing } from './ApertureRing';
import { ApertureOrnament } from './ApertureOrnament';
import { BotanicalSpray } from '../../components/BotanicalSpray';
import { GenreMoodboard } from './GenreMoodboard';
import { GenreGlimpse } from './GenreGlimpse';
import { useApertureMotion } from './use-aperture-motion';
import { wrapGenre } from './aperture-geometry';

export function ApertureGenres() {
  const t = useStrings();
  const { hash } = useLocation();
  const {
    stage,
    ring,
    blade,
    dragging,
    dragHandlers,
    setInteracting,
    active,
    paused,
    setPaused,
    select,
    stepBy,
  } = useApertureMotion();
  const current = genres[active];
  const [params] = useSearchParams();
  const project = params.get('project');
  const destination = `/genres/${current}${project ? `?project=${encodeURIComponent(project)}` : ''}`;

  useEffect(() => {
    if (hash === '#genres') stage.current?.scrollIntoView({ behavior: 'instant' });
  }, [hash, stage]);

  return (
    <section
      id="genres"
      className="aperture-section"
      ref={stage}
      aria-labelledby="aperture-title"
      onFocusCapture={(event) => setInteracting(event.target.matches(':focus-visible'))}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false);
      }}
    >
      <BotanicalSpray className="section-sprig section-sprig-left" blue flowers={false} />
      <BotanicalSpray className="section-sprig section-sprig-right" blue flowers={false} />
      <header className="aperture-heading">
        <p className="eyebrow">{t.curation.ringKicker}</p>
        <h2 id="aperture-title">{t.curation.ringTitle}</h2>
        <p>{t.curation.ringDescription}</p>
      </header>
      <div className="aperture-stage">
        <div className="aperture-clip">
          <ApertureOrnament />
          <div
            className={`aperture-dial${dragging ? ' is-dragging' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label={t.curation.dragLens}
            aria-describedby="aperture-drag-instructions"
            aria-valuemin={1}
            aria-valuemax={genres.length}
            aria-valuenow={active + 1}
            aria-valuetext={t.genreLabels[current]}
            {...dragHandlers}
            onKeyDown={(event) => {
              if (
                ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
                if (event.key === 'Home') select(0);
                else if (event.key === 'End') select(genres.length - 1);
                else stepBy(['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1);
              }
            }}
          >
            <div className="aperture-rotor" ref={ring}>
              <ApertureRing bladeRef={blade} />
            </div>
          </div>
        </div>
        <p className="aperture-drag-hint" aria-hidden="true">
          {t.curation.dragLens}
        </p>
        <span id="aperture-drag-instructions" className="sr-only">
          {t.curation.lensKeyboard}
        </span>
        <div
          role="region"
          className="aperture-stories"
          aria-roledescription={t.curation.carousel}
          aria-label={t.curation.selectGenre}
        >
          <GenreGlimpse
            previous
            genre={genres[wrapGenre(active - 1)]}
            onSelect={() => select(active - 1)}
          />
          <article className="genre-feature">
            <div className="genre-feature-text">
              {genres.map((genre) => (
                <div className="genre-feature-copy" key={genre} aria-hidden={genre !== current}>
                  <span className="genre-label">{t.genreLabels[genre]}</span>
                  <h3>{t.curation.genreStories[genre].title}</h3>
                  <p>{t.curation.genreStories[genre].description}</p>
                </div>
              ))}
            </div>
            <GenreMoodboard genre={current} destination={destination} />
          </article>
          <div className="genre-explore-action">
            <Link className="button-link dark" to={destination}>
              {t.curation.explore}
            </Link>
          </div>
          <GenreGlimpse genre={genres[wrapGenre(active + 1)]} onSelect={() => select(active + 1)} />
          <div className="aperture-controls">
            <button
              className="round-control"
              onClick={() => stepBy(-1)}
              aria-label={t.curation.previous}
            >
              ‹
            </button>
            <div className="aperture-dots" aria-label={t.curation.selectGenre}>
              {genres.map((genre, index) => (
                <button
                  key={genre}
                  onClick={() => select(index)}
                  aria-label={t.genreLabels[genre]}
                  aria-pressed={active === index}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              className="round-control"
              onClick={() => stepBy(1)}
              aria-label={t.curation.next}
            >
              ›
            </button>
            <button
              className="motion-toggle"
              onClick={() => {
                setInteracting(false);
                setPaused(!paused);
              }}
              aria-pressed={paused}
            >
              {paused ? t.curation.play : t.curation.pause}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
