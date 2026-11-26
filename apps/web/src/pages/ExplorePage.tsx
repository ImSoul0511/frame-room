import { Botanical, LeafBranch, WatercolorWash } from '../components/Botanical';
import { ApertureGenres } from '../features/catalog/ApertureGenres';
import { useStrings } from '../lib/i18n';

export function ExplorePage() {
  const t = useStrings();
  return (
    <div className="explore-page home-page">
      <section className="editorial-hero">
        <WatercolorWash />
        <LeafBranch className="hero-leaves-left" />
        <LeafBranch className="hero-leaves-right" />
        <Botanical className="hero-flower-left" meadow />
        <Botanical className="hero-flower-right" meadow />
        <div className="hero-content">
          <p className="eyebrow">{t.discovery.heroKicker}</p>
          <h1>
            {t.discovery.heroFirst}
            <em>{t.discovery.heroSecond}</em>
          </h1>
          <p className="hero-description">{t.discovery.heroDescription}</p>
          <a className="button-link hero-cta emphasis-link" href="#genres">
            {t.design.browsePhotos}
          </a>
        </div>
      </section>
      <ApertureGenres />
    </div>
  );
}
