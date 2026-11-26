import { Link } from 'react-router-dom';
import { LeafBranch } from '../components/Botanical';
import { InfoNavigation } from '../components/InfoNavigation';
import { useStrings } from '../lib/i18n';

export function GuidePage({ topic }: { topic: 'support' | 'community' | 'privacy' }) {
  const t = useStrings();
  const s = t.site;
  const topics = {
    support: [
      { heading: s.accountHelp, text: s.accountText, to: '/auth?mode=reset', link: t.forgot },
      {
        heading: s.bookingHelp,
        text: s.bookingText,
        to: '/bookings',
        link: t.workspaceUi.bookings,
      },
      {
        heading: s.photosHelp,
        text: s.photosText,
        to: '/explore?mode=style',
        link: t.curation.explore,
      },
    ],
    community: [
      { heading: s.rights, text: s.rightsText },
      { heading: s.respect, text: s.respectText },
    ],
    privacy: [
      { heading: s.session, text: s.sessionText },
      { heading: s.cache, text: s.cacheText },
      { heading: s.visibility, text: s.visibilityText },
    ],
  };
  return (
    <article className="site-guide">
      <InfoNavigation />
      <header className="info-hero">
        <div>
          <p className="eyebrow">FrameRoom / {s.resources}</p>
          <h1>{s[topic]}</h1>
          <p>{s[`${topic}Intro`]}</p>
        </div>
        <LeafBranch className="info-hero-branch" />
      </header>
      <div className="guide-layout">
        <nav className="guide-contents" aria-label={s.onThisPage}>
          <p className="eyebrow">{s.onThisPage}</p>
          {topics[topic].map((item, index) => (
            <a key={item.heading} href={`#${topic}-${index}`}>
              {item.heading}
            </a>
          ))}
        </nav>
        <div className="guide-sections">
          {topics[topic].map((item, index) => (
            <section id={`${topic}-${index}`} key={item.heading} className="guide-card">
              <h2>{item.heading}</h2>
              <p>{item.text}</p>
              {'to' in item && (
                <Link className="button-link" to={item.to}>
                  {item.link}
                </Link>
              )}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
