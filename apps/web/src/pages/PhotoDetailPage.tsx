import { Link, useParams, useSearchParams } from 'react-router-dom';
import { QueryState } from '../components/ui';
import { PhotoDiscoveryGrid } from '../features/catalog/PhotoDiscoveryGrid';
import { useApi } from '../lib/hooks';
import { useLanguage, useStrings } from '../lib/i18n';
import type { Image, Portfolio, Tag } from '../lib/types';
import { ReportButton } from './SettingsPage';

export function PhotoDetailPage() {
  const { id = '', photoId } = useParams();
  const [params] = useSearchParams();
  const t = useStrings();
  const { language } = useLanguage();
  const detail = useApi<{ portfolio: Portfolio; images: (Image & { tags: Tag[] })[] }>(
    `/v1/portfolios/${id}`,
  );
  const photo = detail.data?.images.find((image) => image.id === photoId);
  const portfolio = detail.data?.portfolio;
  const project = params.get('project');
  const context = project ? `?project=${encodeURIComponent(project)}` : '';
  if (!photo || !portfolio)
    return (
      <>
        <QueryState query={detail} />
        {detail.isSuccess && <p className="empty-state">{t.site.photoUnavailable}</p>}
      </>
    );
  const providerId = portfolio.photographerId ?? portfolio.studioId;
  const others = detail.data!.images.filter((image) => image.id !== photo.id && image.url);
  return (
    <article className="photo-detail-page">
      <div className="photo-detail-card">
        <div className="photo-detail-visual">
          {photo.url ? (
            <img
              src={photo.url}
              alt={photo.caption || t.profileUi.photo}
              width={photo.width || undefined}
              height={photo.height || undefined}
              decoding="async"
            />
          ) : (
            <p>{t.discovery.noImage}</p>
          )}
        </div>
        <div className="photo-detail-copy">
          <p className="eyebrow">{t.site.photoDetails}</p>
          <h1>{photo.caption || t.profileUi.photo}</h1>
          {providerId && (
            <Link
              className="photo-detail-author"
              to={`/providers/${portfolio.ownerType}/${providerId}${context}`}
            >
              <span className="photo-author-monogram" aria-hidden="true">
                {(portfolio.ownerName || 'F').slice(0, 1)}
              </span>
              <span>{portfolio.ownerName || 'FrameRoom'}</span>
            </Link>
          )}
          {photo.tags?.length > 0 && (
            <div className="genre-chips">
              {photo.tags.map((tag) => (
                <span className="chip" key={tag.id}>
                  {language === 'vi' ? tag.nameVi || tag.name : tag.name}
                </span>
              ))}
            </div>
          )}
          <dl className="photo-detail-facts">
            {photo.crewCredits && (
              <div>
                <dt>{t.site.photoCredits}</dt>
                <dd>{photo.crewCredits}</dd>
              </div>
            )}
            {photo.source && (
              <div>
                <dt>{t.site.photoSource}</dt>
                <dd>{photo.source}</dd>
              </div>
            )}
            {photo.licenseNote && (
              <div>
                <dt>{t.site.photoLicense}</dt>
                <dd>{photo.licenseNote}</dd>
              </div>
            )}
          </dl>
          <section className="photo-detail-album">
            <p className="eyebrow">{t.site.inAlbum}</p>
            <h2>
              <Link to={`/portfolios/${id}${context}`}>{portfolio.title}</Link>
            </h2>
            {portfolio.description && <p>{portfolio.description}</p>}
            <Link className="button-link" to={`/portfolios/${id}${context}`}>
              {t.site.viewAlbum}
            </Link>
          </section>
          <ReportButton targetType="portfolio_image" targetId={photo.id} />
        </div>
      </div>
      {others.length > 0 && (
        <section className="photo-detail-related" aria-labelledby="related-photos-title">
          <h2 id="related-photos-title">{t.site.moreInAlbum}</h2>
          <PhotoDiscoveryGrid
            photos={others.map((image) => ({
              ...image,
              portfolioId: id,
              ownerName: portfolio.ownerName,
              tags: image.tags ?? [],
            }))}
          />
        </section>
      )}
    </article>
  );
}
