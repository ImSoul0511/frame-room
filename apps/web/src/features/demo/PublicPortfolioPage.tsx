import { Link, useParams } from 'react-router-dom';
import { PageHeading, QueryState } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import type { Image, Portfolio } from '../../lib/types';
import { PhotoGallery } from '../profiles/PhotoGallery';
import { useDemo } from './DemoContext';
import { DemoReportButton } from './ReportButton';

export function PublicPortfolioPage() {
  const demo = useDemo();
  const t = useStrings();
  const { id = '' } = useParams();
  const local = demo.state.albums.find((album) => album.id === id);
  const remote = useApi<{ portfolio: Portfolio & { photographerId?: string }; images: Image[] }>(
    `/v1/portfolios/${id}`,
    !local,
  );
  if (local) {
    if (!local.published || local.hidden || demo.state.hiddenTargets.includes(local.id))
      return <p>{t.notFound}</p>;
    return (
      <>
        <PageHeading
          title={demo.text(local.title)}
          subtitle={demo.text(local.description)}
          action={
            <DemoReportButton
              targetType="portfolio"
              targetId={local.id}
              title={demo.text(local.title)}
            />
          }
        />
        <PhotoGallery
          photos={local.photos
            .filter((photo) => !photo.hidden)
            .map((photo, index) => ({
              id: photo.id,
              url: demo.image(photo.url, index),
              caption: photo.name,
              provenance: photo.provenance,
            }))}
        />
      </>
    );
  }
  if (!remote.data) return <QueryState query={remote} />;
  if (demo.state.hiddenTargets.includes(id)) return <p>{t.notFound}</p>;
  const { portfolio, images } = remote.data;
  const provider = portfolio.photographerId ?? portfolio.studioId;
  return (
    <>
      <PageHeading
        title={portfolio.title}
        subtitle={portfolio.description}
        action={
          <DemoReportButton
            targetType="portfolio"
            targetId={portfolio.id}
            title={portfolio.title}
          />
        }
      />
      <div className="row between wrap gallery-heading">
        <span className="muted">
          {images.length} {t.profileUi.photos}
        </span>
        {provider ? (
          <Link className="text-button" to={`/providers/${portfolio.ownerType}/${provider}`}>
            {t.discovery.viewProfile}
          </Link>
        ) : null}
      </div>
      <PhotoGallery photos={images} />
    </>
  );
}
