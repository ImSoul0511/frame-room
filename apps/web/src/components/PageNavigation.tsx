import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStrings } from '../lib/i18n';

const detailParents: Record<string, string> = {
  providers: '/explore',
  portfolios: '/explore',
  genres: '/home#genres',
  projects: '/projects',
  bookings: '/bookings',
  studio: '/studio',
};

export function DetailBack() {
  const t = useStrings();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [, section, id] = pathname.split('/');
  const parent =
    pathname === '/profile'
      ? '/home'
      : pathname === '/settings'
        ? '/profile'
        : id && section
          ? detailParents[section]
          : undefined;
  if (!parent) return null;
  return (
    <button
      type="button"
      className="detail-back"
      onClick={() => {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate(parent, { replace: true });
      }}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path d="m13 5-7 7 7 7M6 12h15" />
      </svg>
      {t.back}
    </button>
  );
}

export function ScrollToTop() {
  const t = useStrings();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 360);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="back-top-icon"
      aria-label={t.design.backToTop}
      title={t.design.backToTop}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        })
      }
    >
      <svg
        aria-hidden="true"
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 20V5m-7 7 7-7 7 7" />
      </svg>
    </button>
  );
}

export function PageFooter() {
  const t = useStrings();
  return (
    <footer className="page-footer site-footer">
      <div className="footer-signature">
        <Link className="footer-brand" to="/home">
          FrameRoom.
        </Link>
        <span className="footer-tagline">{t.discovery.footer}</span>
      </div>
      <div className="footer-resources">
        <nav aria-label={t.site.support}>
          <Link to="/support" aria-label={t.site.support}>
            <span className="footer-label">{t.site.support}</span>
            <span className="footer-label-short">{t.site.supportShort}</span>
          </Link>
          <Link to="/community" aria-label={t.site.community}>
            <span className="footer-label">{t.site.community}</span>
            <span className="footer-label-short">{t.site.communityShort}</span>
          </Link>
          <Link to="/privacy" aria-label={t.site.privacy}>
            <span className="footer-label">{t.site.privacy}</span>
            <span className="footer-label-short">{t.site.privacyShort}</span>
          </Link>
        </nav>
        <small>
          © {new Date().getFullYear()}
          <span className="footer-copyright-name"> FrameRoom</span>
        </small>
      </div>
    </footer>
  );
}
