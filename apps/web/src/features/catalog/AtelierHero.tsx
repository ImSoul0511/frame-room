import { Link } from 'react-router-dom';
import { useStrings } from '../../lib/i18n';
export function AtelierHero() {
  const t = useStrings();
  return (
    <section className="atelier-hero">
      <div className="atelier-hero-copy">
        <p className="eyebrow">
          <span className="atelier-dot" />
          {t.atelier.heroKicker}
        </p>
        <h1>
          {t.atelier.heroFirst}
          <em>{t.atelier.heroSecond}</em>
        </h1>
        <p className="atelier-hero-description">{t.atelier.heroDescription}</p>
        <div className="atelier-hero-actions">
          <a className="button-link dark" href="#photographers">
            {t.atelier.discover} <span aria-hidden="true">↗</span>
          </a>
          <Link className="atelier-text-link" to="/projects">
            {t.atelier.start} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="atelier-hero-footnote">
          <span aria-hidden="true">✳</span>
          <p>{t.atelier.frameNote}</p>
        </div>
      </div>
      <div className="atelier-hero-art">
        <figure className="atelier-print print-portrait">
          <img
            src="/images/editorial-portrait.jpg"
            alt={t.genreLabels.portrait}
            fetchPriority="high"
          />
          <figcaption>
            <span>FR — 001</span>
            <span>{t.genreLabels.portrait}</span>
          </figcaption>
        </figure>
        <figure className="atelier-print print-fashion">
          <img src="/images/editorial-fashion.jpg" alt={t.genreLabels.fashion} />
          <figcaption>
            <span>FR — 002</span>
            <span>{t.genreLabels.fashion}</span>
          </figcaption>
        </figure>
        <p className="atelier-art-note" aria-hidden="true">
          FRAME
          <br />
          OF MIND.
        </p>
        <span className="atelier-image-credit">{t.atelier.inspiration}</span>
      </div>
    </section>
  );
}
