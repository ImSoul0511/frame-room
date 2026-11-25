import { Link } from 'react-router-dom';
import portrait from '../assets/genres/portrait.webp';
import wedding from '../assets/genres/wedding.webp';
import { useStrings } from '../lib/i18n';

export function AboutPage() {
  const t = useStrings();
  return (
    <section className="about-story">
      <header className="about-spread">
        <div className="about-intro">
          <p className="eyebrow">{t.curation.aboutKicker}</p>
          <h1>{t.curation.aboutTitle}</h1>
          <p>{t.curation.aboutDescription}</p>
          <Link className="button-link dark" to="/explore">
            {t.curation.explore}
          </Link>
        </div>
        <div className="about-photographs" aria-hidden="true">
          <img className="about-portrait" src={portrait} alt="" />
          <img className="about-print" src={wedding} alt="" />
        </div>
      </header>
      <div className="about-chapters">
        <article>
          <h2>{t.curation.aboutStepOne}</h2>
          <p>{t.curation.aboutStepOneDescription}</p>
          <Link className="text-button" to="/home#genres">
            {t.curation.genres}
          </Link>
        </article>
        <article>
          <h2>{t.curation.aboutStepTwo}</h2>
          <p>{t.curation.aboutStepTwoDescription}</p>
          <Link className="text-button" to="/photographers">
            {t.curation.photographers}
          </Link>
        </article>
        <article>
          <h2>{t.curation.aboutStepThree}</h2>
          <p>{t.curation.aboutStepThreeDescription}</p>
          <Link className="text-button" to="/projects">
            {t.nav.projects}
          </Link>
        </article>
      </div>
    </section>
  );
}
