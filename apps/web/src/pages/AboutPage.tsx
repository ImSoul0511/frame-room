import { Link } from 'react-router-dom';
import { Botanical, LeafBranch } from '../components/Botanical';
import { useStrings } from '../lib/i18n';

export function AboutPage() {
  const t = useStrings();
  return (
    <section className="about-page">
      <header className="directory-heading">
        <p className="eyebrow">{t.curation.aboutKicker}</p>
        <h1>{t.curation.aboutTitle}</h1>
        <p>{t.curation.aboutDescription}</p>
      </header>
      <div className="about-garden" aria-hidden="true">
        <LeafBranch />
        <span>FrameRoom.</span>
        <Botanical />
      </div>
      <div className="about-steps">
        <article>
          <h2>{t.curation.aboutStepOne}</h2>
          <p>{t.curation.aboutStepOneDescription}</p>
          <Link className="text-button" to="/explore#genres">
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
